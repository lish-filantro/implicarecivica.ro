/**
 * Email Injection Helper — Simulates institution responses
 *
 * Instead of sending real emails, we:
 * 1. Upload PDF to Supabase Storage
 * 2. Insert email record (mimicking webhook behavior)
 * 3. Trigger /api/emails/process
 *
 * This tests the full pipeline: OCR → Classification → Matching → Status Update
 */
import { randomUUID } from 'crypto';
import { getTestSupabase, TEST_USER_ID, TEST_CITIZEN_EMAIL } from './supabase-test-client';

export interface InjectEmailOpts {
  /** Request ID to enable context matching */
  requestId?: string;
  /** Parent email ID for thread matching */
  parentEmailId?: string;
  /** Sender email (institution) */
  fromEmail: string;
  /** Email subject */
  subject: string;
  /** HTML body text */
  body?: string;
  /** PDF file bytes (if any) */
  pdfBytes?: Buffer;
  /** PDF filename */
  pdfFileName?: string;
}

export interface InjectResult {
  emailId: string;
  storagePath: string | null;
}

/**
 * Inject a simulated institution email into DB + Storage.
 * Does NOT trigger processing — call triggerProcess() separately.
 */
export async function injectEmail(opts: InjectEmailOpts): Promise<InjectResult> {
  const supabase = getTestSupabase();
  const emailId = randomUUID();
  let storagePath: string | null = null;

  // 1. Upload PDF to Supabase Storage (if provided)
  if (opts.pdfBytes) {
    storagePath = `${TEST_USER_ID}/${emailId}/${opts.pdfFileName || 'document.pdf'}`;
    const { error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(storagePath, opts.pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`PDF upload failed: ${uploadError.message}`);
    }
  }

  // 2. Insert email record (mimics what the webhook handler does)
  const { error: insertError } = await supabase.from('emails').insert({
    id: emailId,
    user_id: TEST_USER_ID,
    parent_email_id: opts.parentEmailId || null,
    message_id: `<test-${emailId}@e2e-test.ro>`,
    type: 'received',
    from_email: opts.fromEmail,
    to_email: TEST_CITIZEN_EMAIL,
    subject: opts.subject,
    body: opts.body || '',
    pdf_file_path: storagePath,
    processing_status: 'pending',
    is_read: false,
    received_at: new Date().toISOString(),
    attachments: storagePath
      ? [{ name: opts.pdfFileName || 'document.pdf', type: 'application/pdf', path: storagePath }]
      : [],
  });

  if (insertError) {
    throw new Error(`Email insert failed: ${insertError.message}`);
  }

  return { emailId, storagePath };
}

/**
 * Trigger the email processing pipeline for a given email ID.
 *
 * Calls the processEmail logic directly via Supabase-stored email,
 * using the same pipeline as /api/emails/process.
 */
export async function triggerProcess(emailId: string): Promise<{
  success: boolean;
  category?: string;
  matchedRequestId?: string;
  matchStrategy?: string;
  statusUpdate?: string;
  error?: string;
}> {
  // We import dynamically to avoid loading Next.js route modules at test init
  const { runOcrFromBytes } = await import('@/lib/services/ocr-service');
  const { analyzeEmailContent } = await import('@/lib/services/analysis-service');
  const { matchEmailToRequest, autoHealRegistrationNumber } = await import('@/lib/services/request-matching');
  const { applyStatusUpdate } = await import('@/lib/services/status-updater');

  const supabase = getTestSupabase();

  // Fetch email
  const { data: email, error: fetchError } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .single();

  if (fetchError || !email) {
    return { success: false, error: `Email not found: ${fetchError?.message}` };
  }

  try {
    // Mark as processing
    await supabase
      .from('emails')
      .update({ processing_status: 'processing' })
      .eq('id', emailId);

    // OCR
    let ocrText = '';
    if (email.pdf_file_path) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from('email-attachments')
        .download(email.pdf_file_path);

      if (!dlError && fileData) {
        const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
        const ocrResult = await runOcrFromBytes(pdfBytes);
        ocrText = ocrResult.markdown;

        await supabase
          .from('emails')
          .update({
            ocr_text: ocrText,
            ocr_processed: true,
            ocr_processed_at: new Date().toISOString(),
          })
          .eq('id', emailId);
      }
    }

    // Analysis
    const bodyText = (email.body || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim();

    const analysis = await analyzeEmailContent({
      subject: email.subject,
      body: bodyText,
      ocrText: ocrText || undefined,
      fromEmail: email.from_email,
    });

    // Save analysis
    await supabase
      .from('emails')
      .update({
        category: analysis.category,
        registration_number: analysis.registration_number,
        ai_extracted_data: {
          analysis: {
            category: analysis.category,
            registration_number: analysis.registration_number,
            answer_summary: analysis.answer_summary,
            confidence: analysis.confidence,
            evidence: analysis.evidence,
          },
        },
      })
      .eq('id', emailId);

    // Debug: log what Mistral extracted
    console.log(`[Debug] Analysis for ${emailId}: category=${analysis.category}, reg_number=${analysis.registration_number || 'NULL'}, confidence=${analysis.confidence}`);

    // Matching
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
      if (analysis.registration_number) {
        await autoHealRegistrationNumber(match.requestId, analysis.registration_number);
      }

      const update = await applyStatusUpdate(
        match.requestId,
        emailId,
        email.received_at || email.created_at,
        analysis,
      );

      if (update) {
        statusUpdateResult = `${update.previousStatus} → ${update.newStatus}`;
      }
    }

    // Mark completed
    await supabase
      .from('emails')
      .update({ processing_status: 'completed', error_log: null })
      .eq('id', emailId);

    return {
      success: true,
      category: analysis.category,
      matchedRequestId: match?.requestId,
      matchStrategy: match?.strategy,
      statusUpdate: statusUpdateResult,
    };
  } catch (err: any) {
    await supabase
      .from('emails')
      .update({ processing_status: 'failed', error_log: err.message })
      .eq('id', emailId);

    return { success: false, error: err.message };
  }
}

/**
 * Inject + process in one call (convenience)
 */
export async function injectAndProcess(opts: InjectEmailOpts) {
  const { emailId, storagePath } = await injectEmail(opts);
  const result = await triggerProcess(emailId);
  return { emailId, storagePath, ...result };
}
