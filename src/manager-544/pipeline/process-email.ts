/**
 * Orchestration of one received email:
 *   1. load          2. ataşamentul PDF         3. analysis (classification, citeşte PDF-ul)
 *   4. matching      5. status update           6. mark completed / schedule retry
 *
 * All I/O goes through injected deps so the whole flow is unit-testable.
 */
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import type { InstitutionsRepo } from '@m544/shared/db/institutions-repo';
import type { Email } from '@m544/shared/types/email';
import { htmlToText } from '@m544/shared/utils/html-to-text';
import { extractEmail } from '@m544/inbound/webhook/addresses';
import type { OcrResult } from '@m544/pipeline/ocr';
import { analyzeEmailContent, type AnalysisInput } from '@m544/pipeline/analysis';
import { matchEmailToRequest, autoHealRegistrationNumber } from '@m544/pipeline/matching';
import { applyStatusUpdate } from '@m544/pipeline/status';
import type { AnalysisResult, MatchOutcome } from '@m544/pipeline/types';

export const MAX_RETRIES = 3;

export interface ProcessDeps {
  emails: EmailsRepo;
  requests: RequestsRepo;
  storage: StorageRepo;
  /** Ieşire de siguranţă: când e dat, PDF-ul trece printr-un OCR extern în loc să ajungă la model. */
  ocr?: (pdfBytes: Uint8Array) => Promise<OcrResult>;
  analyze?: (input: AnalysisInput) => Promise<AnalysisResult>;
  /** Learns the institution's real address from matched answers (institutii_locale); optional, best-effort. */
  institutions?: InstitutionsRepo;
}

export interface ProcessResult {
  success: boolean;
  emailId: string;
  category?: string;
  matchedRequestId?: string;
  matchStrategy?: string;
  statusUpdate?: string;
  needsReview?: boolean;
  skipped?: string;
  error?: string;
}

/**
 * Ataşamentul PDF, în forma pe care o aşteaptă clasificarea.
 *
 * Implicit îl dăm modelului ca atare: Claude redă fiecare pagină şi ca imagine, şi ca text
 * extras, deci ştampilele, semnăturile şi numerele de înregistrare scrise de mână — exact
 * datele pe care se sprijină potrivirea — nu se mai pierd la transcriere. Nu mai există un
 * pas de OCR separat, deci nici eşecul lui tăcut: o eroare aici opreşte procesarea şi
 * emailul rămâne reluabil, în loc să fie clasificat doar după subiect şi marcat `completed`.
 *
 * `deps.ocr` rămâne ca ieşire de siguranţă: când e injectat (teste, sau un furnizor de
 * analiză care nu citeşte documente), se păstrează vechiul flux prin OCR şi textul se
 * memorează în `ocr_text`.
 */
async function loadPdfForAnalysis(
  email: Email,
  deps: ProcessDeps,
): Promise<{ pdf?: Uint8Array; ocrText?: string }> {
  if (!email.pdf_file_path) return {};

  if (deps.ocr) {
    if (email.ocr_processed) return { ocrText: email.ocr_text ?? '' };
    const bytes = await deps.storage.download(email.pdf_file_path);
    if (!bytes) {
      console.warn(`[Process] PDF not found in storage: ${email.pdf_file_path}`);
      return {};
    }
    const result = await deps.ocr(bytes);
    await deps.emails.update(email.id, {
      ocr_text: result.markdown,
      ocr_processed: true,
      ocr_processed_at: new Date().toISOString(),
      ai_extracted_data: { ...(email.ai_extracted_data ?? {}), ocr: { pages: result.pages, docSizeBytes: result.docSizeBytes } },
    });
    return { ocrText: result.markdown };
  }

  const bytes = await deps.storage.download(email.pdf_file_path);
  if (!bytes) {
    // Lipsa fişierului din storage nu e o eroare trecătoare: o reîncercare n-ar schimba
    // nimic, deci clasificăm pe subiect şi corp în loc să blocăm emailul în retry.
    console.warn(`[Process] PDF not found in storage: ${email.pdf_file_path}`);
    return {};
  }
  return { pdf: bytes };
}

async function saveAnalysis(email: Email, analysis: AnalysisResult, deps: ProcessDeps): Promise<void> {
  await deps.emails.update(email.id, {
    category: analysis.category,
    registration_number: analysis.registration_number,
    ai_extracted_data: {
      ...(email.ai_extracted_data ?? {}),
      analysis: {
        category: analysis.category,
        registration_number: analysis.registration_number,
        answer_summary: analysis.answer_summary,
        redirected_to: analysis.redirected_to,
        confidence: analysis.confidence,
        evidence: analysis.evidence,
        extension_days: analysis.extension_days,
        extension_reason: analysis.extension_reason,
      },
    },
  });
}

async function matchAndUpdate(
  email: Email,
  analysis: AnalysisResult,
  deps: ProcessDeps,
): Promise<Pick<ProcessResult, 'matchedRequestId' | 'matchStrategy' | 'statusUpdate' | 'needsReview'>> {
  const outcome: MatchOutcome = await matchEmailToRequest(
    {
      id: email.id,
      user_id: email.user_id,
      parent_email_id: email.parent_email_id ?? null,
      from_email: email.from_email,
      subject: email.subject,
    },
    analysis,
    deps,
  );

  // Every unmatched email reaching here is relevant correspondence ('irelevant' never gets
  // matched): flag it so it surfaces in "De revizuit" instead of sitting silently in the inbox.
  if (!outcome.match) {
    await deps.emails.update(email.id, { needs_review: true });
    console.log(`[Process] ${email.id}: no match (${outcome.reason})`);
    return { needsReview: true };
  }

  const { requestId, strategy } = outcome.match;
  if (analysis.registration_number) await autoHealRegistrationNumber(requestId, analysis.registration_number, deps.requests);

  const update = await applyStatusUpdate(requestId, email.id, email.received_at || email.created_at, analysis, {
    requests: deps.requests,
    emails: deps.emails,
    viaThread: strategy === 'thread',
  });

  return {
    matchedRequestId: requestId,
    matchStrategy: strategy,
    statusUpdate: update ? `${update.previousStatus} → ${update.newStatus}` : undefined,
    needsReview: update?.needsReview ?? false,
  };
}

/**
 * A matched answer proves which address the institution really answers from:
 * record it (source 'raspuns') so the chat can reuse it. Never fails processing.
 */
async function learnInstitutionAddress(email: Email, requestId: string, deps: ProcessDeps): Promise<void> {
  if (!deps.institutions) return;
  try {
    const request = await deps.requests.getById(requestId);
    if (!request) return;
    await deps.institutions.recordVerifiedEmail({
      name: request.institution_name,
      email: extractEmail(email.from_email),
      source: 'raspuns',
    });
  } catch (err) {
    console.error(`[Process] ${email.id}: recording institution address failed:`, err instanceof Error ? err.message : err);
  }
}

export async function processEmail(emailId: string, deps: ProcessDeps): Promise<ProcessResult> {
  const email = await deps.emails.getById(emailId);
  if (!email) return { success: false, emailId, error: 'Email not found' };
  if (email.processing_status === 'completed') return { success: true, emailId, category: email.category ?? undefined };
  if (email.type !== 'received') return { success: true, emailId, skipped: 'not a received email' };

  try {
    await deps.emails.update(emailId, { processing_status: 'processing' });

    const { pdf, ocrText } = await loadPdfForAnalysis(email, deps);
    const analysis = await (deps.analyze ?? analyzeEmailContent)({
      subject: email.subject,
      body: htmlToText(email.body ?? ''),
      ocrText: ocrText || undefined,
      pdf,
      fromEmail: email.from_email,
    });
    await saveAnalysis(email, analysis, deps);

    const outcome = analysis.category === 'irelevant' ? {} : await matchAndUpdate(email, analysis, deps);
    if (outcome.matchedRequestId) await learnInstitutionAddress(email, outcome.matchedRequestId, deps);

    await deps.emails.update(emailId, { processing_status: 'completed', error_log: null });
    console.log(`[Process] ${emailId}: category=${analysis.category}, match=${outcome.matchStrategy ?? 'none'}`);
    return { success: true, emailId, category: analysis.category, ...outcome };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const retryCount = (email.retry_count ?? 0) + 1;
    await deps.emails.update(emailId, {
      processing_status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
      retry_count: retryCount,
      error_log: message,
    });
    console.error(`[Process] ${emailId} failed (attempt ${retryCount}):`, message);
    return { success: false, emailId, error: message };
  }
}
