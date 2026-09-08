/**
 * Matching orchestrator — links a received email to an existing request.
 * Order: thread → registration number → context (sender).
 * Never creates fallback requests (that produced duplicates in the past).
 */
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import type { AnalysisResult, MatchableEmail, MatchOutcome, MatchResult } from '@m544/pipeline/types';
import { matchByThread } from './thread';
import { matchByRegistration } from './registration';
import { matchByContext } from './context';

export interface MatchDeps {
  requests: RequestsRepo;
  emails: EmailsRepo;
}

const found = (match: MatchResult): MatchOutcome => ({
  match,
  needsReview: false,
  reason: `${match.strategy} (${match.confidence})`,
});

export async function matchEmailToRequest(
  email: MatchableEmail,
  analysis: AnalysisResult,
  deps: MatchDeps,
): Promise<MatchOutcome> {
  const byThread = await matchByThread(email, deps.emails);
  if (byThread) return found(byThread);

  if (analysis.registration_number) {
    const byReg = await matchByRegistration(email.user_id, analysis.registration_number, deps.requests);
    if (byReg) return found(byReg);
  }

  return matchByContext(email, deps.requests, deps.emails);
}

/**
 * Auto-heal: a matched request without a registration number receives the
 * one extracted from the email. An existing number is never overwritten.
 */
export async function autoHealRegistrationNumber(
  requestId: string,
  registrationNumber: string,
  requests: RequestsRepo,
): Promise<void> {
  const request = await requests.getById(requestId);
  if (!request || request.registration_number) return;
  await requests.update(requestId, { registration_number: registrationNumber });
}
