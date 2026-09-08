/**
 * Applies a classified email to its matched request: plan the transition (pure),
 * persist the patch, and link the email to the request.
 */
import type { AnalysisResult, StatusUpdateResult } from '@m544/pipeline/types';
import type { EmailPatch, EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import { planTransition } from './transitions';

export interface ApplyDeps {
  requests: RequestsRepo;
  emails: EmailsRepo;
  /** The email arrived on the thread of one we sent for this request. */
  viaThread?: boolean;
}

/**
 * Returns the applied transition, or null when nothing was applied (missing request,
 * terminal state, irrelevant/outgoing category, or no effective change). The email
 * is still linked to an existing request unless the category is 'irelevant'.
 */
export async function applyStatusUpdate(
  requestId: string,
  emailId: string,
  emailReceivedAt: string,
  analysis: AnalysisResult,
  deps: ApplyDeps,
): Promise<StatusUpdateResult | null> {
  const request = await deps.requests.getById(requestId);
  if (!request) {
    console.error(`[StatusUpdate] Request ${requestId} not found`);
    return null;
  }

  const result = planTransition({
    current: request,
    analysis,
    emailReceivedAt,
    viaThread: deps.viaThread ?? false,
  });

  if (result.skipped || Object.keys(result.changes).length === 0) {
    console.log(`[StatusUpdate] ${requestId}: no change (${result.skipped ?? 'nothing to apply'})`);
    if (analysis.category !== 'irelevant') await deps.emails.update(emailId, { request_id: requestId });
    return null;
  }

  // Read before writing: a repository may hand back the same object it later mutates.
  const previousStatus = request.status;
  const newStatus = result.newStatus ?? previousStatus;

  await deps.requests.update(requestId, result.changes);

  const emailPatch: EmailPatch = { request_id: requestId };
  if (result.needsReview) emailPatch.needs_review = true;
  await deps.emails.update(emailId, emailPatch);

  console.log(
    `[StatusUpdate] ${requestId}: ${previousStatus} → ${newStatus}` + (result.needsReview ? ' (needs review)' : ''),
  );

  return { previousStatus, newStatus, changes: result.changes, needsReview: result.needsReview };
}
