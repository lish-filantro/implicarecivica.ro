/**
 * POST /api/emails/process
 *
 * Main orchestration endpoint for the email processing pipeline:
 *   1. Fetch email from DB
 *   2. Download PDF from Supabase Storage → Mistral OCR
 *   3. Mistral Large analysis (classification + data extraction)
 *   4. Match email to existing request (3-tier strategy)
 *   5. Update request status + deadlines
 *   6. Mark email as processed
 *
 * Called by:
 *   - Vercel Cron (/api/cron/process-emails) for pending emails
 *   - Manually via admin trigger
 *
 * Security: requires CRON_SECRET or authenticated user (service role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { runOcrFromBytes } from '@/lib/services/ocr-service';
import { analyzeEmailContent } from '@/lib/services/analysis-service';
import { matchEmailToRequest, autoHealRegistrationNumber } from '@/lib/services/request-matching';
import { applyStatusUpdate } from '@/lib/services/status-updater';
import { htmlToText } from '@/lib/utils/html-to-text';

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Process a single email through the full pipeline.
 */
async function processEmail(emailId: string): Promise<{
  success: boolean;
  emailId: string;
  category?: string;
  matchedRequestId?: string;
  matchStrategy?: string;
  statusUpdate?: string;
  error?: string;
}> {
  const supabase = getServiceClient();

  // 1. Fetch email
  const { data: email, error: fetchError } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .single();

  if (fetchError || !email) {
    return { success: false, emailId, error: `Email not found: ${fetchError?.message}` };
  }

  // Skip if already processed
  if (email.processing_status === 'completed') {
    return { success: true, emailId, category: email.category };
  }

  // Skip sent emails — only process received
  if (email.type !== 'received') {
    return { success: true, emailId, error: 'Skipped: not a received email' };
  }

  try {
    // Mark as processing
    await supabase
      .from('emails')
      .update({ processing_status: 'processing' })
      .eq('id', emailId);

    // 2. OCR if PDF attachment exists
    let ocrText = email.ocr_text || '';

    if (email.pdf_file_path && !email.ocr_processed) {
      console.log(`[Process] Running OCR for email ${emailId}...`);
      try {
        // Download PDF from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('email-attachments')
          .download(email.pdf_file_path);

        if (downloadError || !fileData) {
          console.warn(`[Process] PDF download failed: ${downloadError?.message}`);
        } else {
          const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
          const ocrResult = await runOcrFromBytes(pdfBytes);
          ocrText = ocrResult.markdown;

          // Save OCR results
          await supabase
            .from('emails')
            .update({
              ocr_text: ocrText,
              ocr_processed: true,
              ocr_processed_at: new Date().toISOString(),
              ai_extracted_data: {
                ...(email.ai_extracted_data || {}),
                ocr: { pages: ocrResult.pages, docSizeBytes: ocrResult.docSizeBytes },
              },
            })
            .eq('id', emailId);
        }
      } catch (ocrError: any) {
        console.error(`[Process] OCR failed for ${emailId}:`, ocrError.message);
        // Continue — we can still analyze subject + body without OCR
      }
    }

    // 3. AI Analysis
    console.log(`[Process] Running analysis for email ${emailId}...`);
    const bodyText = htmlToText(email.body || '');

    const analysis = await analyzeEmailContent({
      subject: email.subject,
      body: bodyText,
      ocrText: ocrText || undefined,
      fromEmail: email.from_email,
    });

    // Save analysis results on email
    await supabase
      .from('emails')
      .update({
        category: analysis.category,
        registration_number: analysis.registration_number,
        ai_extracted_data: {
          ...(email.ai_extracted_data || {}),
          analysis: {
            category: analysis.category,
            registration_number: analysis.registration_number,
            answer_summary: analysis.answer_summary,
            confidence: analysis.confidence,
            evidence: analysis.evidence,
            extension_days: analysis.extension_days,
            extension_reason: analysis.extension_reason,
          },
        },
      })
      .eq('id', emailId);

    // 4. Match email to request
    console.log(`[Process] Matching email ${emailId} to request...`);
    const match = await matchEmailToRequest(
      {
        id: email.id,
        user_id: email.user_id,
        parent_email_id: email.parent_email_id,
        from_email: email.from_email,
        subject: email.subject,
      },
      analysis,
    );

    let statusUpdateResult: string | undefined;

    if (match) {
      // Auto-heal registration number if needed
      if (analysis.registration_number) {
        await autoHealRegistrationNumber(match.requestId, analysis.registration_number);
      }

      // 5. Update request status
      console.log(`[Process] Updating status for request ${match.requestId}...`);
      const emailDate = email.received_at || email.created_at;
      const update = await applyStatusUpdate(
        match.requestId,
        emailId,
        emailDate,
        analysis,
      );

      if (update) {
        statusUpdateResult = `${update.previousStatus} → ${update.newStatus}`;
      }
    }

    // 6. Mark as completed
    await supabase
      .from('emails')
      .update({
        processing_status: 'completed',
        error_log: null,
      })
      .eq('id', emailId);

    console.log(
      `[Process] Email ${emailId} processed: category=${analysis.category}, ` +
      `match=${match?.strategy || 'none'}, status=${statusUpdateResult || 'no change'}`,
    );

    return {
      success: true,
      emailId,
      category: analysis.category,
      matchedRequestId: match?.requestId,
      matchStrategy: match?.strategy,
      statusUpdate: statusUpdateResult,
    };
  } catch (err: any) {
    console.error(`[Process] Failed for email ${emailId}:`, err.message);

    // Update retry count and error log
    const newRetryCount = (email.retry_count || 0) + 1;
    const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';

    await supabase
      .from('emails')
      .update({
        processing_status: newStatus,
        retry_count: newRetryCount,
        error_log: `${err.name}: ${err.message}`,
      })
      .eq('id', emailId);

    return {
      success: false,
      emailId,
      error: err.message,
    };
  }
}

/**
 * POST /api/emails/process
 *
 * Body: { email_id: string } — process single email
 *    or { batch: true }      — process all pending emails (used by cron)
 */
export async function POST(request: NextRequest) {
  // Security: verify cron secret or service key
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && cronSecret !== 'placeholder') {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();

    // Single email processing
    if (body.email_id) {
      const result = await processEmail(body.email_id);
      return NextResponse.json(result);
    }

    // Batch processing (for cron)
    if (body.batch) {
      const supabase = getServiceClient();
      const limit = body.limit || 5;

      const { data: pendingEmails, error } = await supabase
        .from('emails')
        .select('id')
        .eq('type', 'received')
        .in('processing_status', ['pending'])
        .lt('retry_count', 3)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!pendingEmails || pendingEmails.length === 0) {
        return NextResponse.json({ processed: 0, results: [] });
      }

      // Process sequentially (to stay within Vercel timeout)
      const results = [];
      for (const email of pendingEmails) {
        const result = await processEmail(email.id);
        results.push(result);
      }

      return NextResponse.json({
        processed: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    }

    return NextResponse.json({ error: 'Provide email_id or batch: true' }, { status: 400 });
  } catch (error: any) {
    console.error('[Process Route] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
