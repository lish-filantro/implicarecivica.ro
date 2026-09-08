/**
 * Manual review of a received email (pure orchestration over injected repos):
 *   assign     — link the email to one of the user's requests and re-apply the
 *                saved analysis to that request's status;
 *   reclassify — record the correction as classification feedback, store the
 *                new category and (when linked) re-apply the transition with it;
 *   dismiss    — the user looked and nothing needs changing.
 * Every path ends with `needs_review = false`.
 */
import { applyStatusUpdate } from '@m544/pipeline/status';
import type { AnalysisResult } from '@m544/pipeline/types';
import type { EmailPatch, EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import type { Email } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';
import { analysisFromEmail, fallbackAnalysis } from './analysis-from-email';
import type { ReviewRepo } from './repo';

export type ReviewAction =
  | { action: 'assign'; request_id: string }
  | { action: 'reclassify'; category: EmailCategory; note?: string | null }
  | { action: 'dismiss' };

export interface ReviewInput {
  emailId: string;
  userId: string;
  action: ReviewAction;
}

export interface ReviewDeps {
  emails: EmailsRepo;
  requests: RequestsRepo;
  review: ReviewRepo;
}

export type ReviewResult = { ok: true; email: Email } | { ok: false; status: 404; error: string };

export const EMAIL_NOT_FOUND = 'Emailul nu a fost găsit';
export const REQUEST_NOT_FOUND = 'Cererea nu a fost găsită';

const notFound = (error: string): ReviewResult => ({ ok: false, status: 404, error });

async function reapply(email: Email, requestId: string, analysis: AnalysisResult, deps: ReviewDeps): Promise<void> {
  await applyStatusUpdate(requestId, email.id, email.received_at ?? email.created_at, analysis, {
    requests: deps.requests,
    emails: deps.emails,
    viaThread: false,
  });
}

async function assign(email: Email, userId: string, requestId: string, deps: ReviewDeps): Promise<ReviewResult | null> {
  const request = await deps.requests.getById(requestId);
  if (!request || request.user_id !== userId) return notFound(REQUEST_NOT_FOUND);

  const analysis = analysisFromEmail(email);
  if (analysis) await reapply(email, requestId, analysis, deps);
  // Written last: the transition may re-flag the email, but the user has just reviewed it.
  await deps.emails.update(email.id, { request_id: requestId, needs_review: false });
  return null;
}

async function reclassify(
  email: Email,
  userId: string,
  category: EmailCategory,
  note: string | null | undefined,
  deps: ReviewDeps,
): Promise<void> {
  await deps.review.insertFeedback({
    email_id: email.id,
    user_id: userId,
    previous_category: email.category ?? null,
    new_category: category,
    note: note?.trim() || null,
  });

  const patch: EmailPatch = { category, needs_review: false };
  if (category === 'irelevant') {
    patch.request_id = null;
  } else if (email.request_id) {
    const saved = analysisFromEmail(email) ?? fallbackAnalysis(category, email);
    await reapply(email, email.request_id, { ...saved, category }, deps);
  }
  await deps.emails.update(email.id, patch);
}

export async function reviewEmail({ emailId, userId, action }: ReviewInput, deps: ReviewDeps): Promise<ReviewResult> {
  const email = await deps.emails.getById(emailId);
  if (!email || email.user_id !== userId) return notFound(EMAIL_NOT_FOUND);

  switch (action.action) {
    case 'assign': {
      const failure = await assign(email, userId, action.request_id, deps);
      if (failure) return failure;
      break;
    }
    case 'reclassify':
      await reclassify(email, userId, action.category, action.note, deps);
      break;
    case 'dismiss':
      await deps.emails.update(email.id, { needs_review: false });
      break;
  }

  const refreshed = await deps.emails.getById(emailId);
  return refreshed ? { ok: true, email: refreshed } : notFound(EMAIL_NOT_FOUND);
}
