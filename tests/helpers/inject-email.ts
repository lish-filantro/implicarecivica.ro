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
 * Runs the same orchestration as /api/emails/process (src/manager-544/pipeline)
 * against the real Supabase + Mistral, without going through HTTP.
 */
export async function triggerProcess(emailId: string): Promise<{
  success: boolean;
  category?: string;
  matchedRequestId?: string;
  matchStrategy?: string;
  statusUpdate?: string;
  needsReview?: boolean;
  error?: string;
}> {
  const { processEmail } = await import('@m544/pipeline/process-email');
  const { createPipelineDeps } = await import('@m544/pipeline/deps');
  const result = await processEmail(emailId, createPipelineDeps());
  console.log(
    `[Debug] Processed ${emailId}: category=${result.category ?? '-'}, match=${result.matchStrategy ?? 'none'}, status=${result.statusUpdate ?? 'no change'}${result.error ? `, error=${result.error}` : ''}`,
  );
  return result;
}

/**
 * Inject + process in one call (convenience)
 */
export async function injectAndProcess(opts: InjectEmailOpts) {
  const { emailId, storagePath } = await injectEmail(opts);
  const result = await triggerProcess(emailId);
  return { emailId, storagePath, ...result };
}
