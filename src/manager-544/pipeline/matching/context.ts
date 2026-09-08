/**
 * Strategy 3 — context: who sent the email, among the user's open requests.
 *
 * Evidence (either one qualifies a request as a candidate):
 *   (a) sender address equals the request's institution_email
 *   (b) we sent an email for that request to the sender address
 *
 * The subject is deliberately NOT evidence: every request carries the same
 * fixed subject ("Cerere informații publice - Legea 544/2001"), so matching
 * on it always picked an arbitrary request.
 *
 *   exactly 1 candidate → match (medium)
 *   several candidates  → no match, flagged for manual review
 *   none                → no match
 */
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { OpenRequest, RequestsRepo } from '@m544/shared/db/requests-repo';
import type { MatchableEmail, MatchOutcome } from '@m544/pipeline/types';
import { extractEmailAddr } from './normalize';

export const NO_MATCH: MatchOutcome = { match: null, needsReview: false, reason: 'no match' };

type Evidence = 'sender is institution email' | 'we sent to this address';

async function evidenceFor(req: OpenRequest, sender: string, emails: EmailsRepo): Promise<Evidence | null> {
  if (req.institution_email && extractEmailAddr(req.institution_email) === sender) {
    return 'sender is institution email';
  }
  if (await emails.hasSentToAddress(req.id, sender)) return 'we sent to this address';
  return null;
}

export async function matchByContext(
  email: Pick<MatchableEmail, 'user_id' | 'from_email' | 'subject'>,
  requests: RequestsRepo,
  emails: EmailsRepo,
): Promise<MatchOutcome> {
  const sender = extractEmailAddr(email.from_email);
  if (!sender) return NO_MATCH;

  const candidates: Array<{ req: OpenRequest; evidence: Evidence }> = [];
  for (const req of await requests.listOpen(email.user_id)) {
    const evidence = await evidenceFor(req, sender, emails);
    if (evidence) candidates.push({ req, evidence });
  }

  if (candidates.length === 0) return NO_MATCH;
  if (candidates.length > 1) {
    return {
      match: null,
      needsReview: true,
      reason: `ambiguous: ${candidates.length} candidate requests for sender ${sender}`,
    };
  }

  const [{ req, evidence }] = candidates;
  return {
    match: { requestId: req.id, strategy: 'context', confidence: 'medium' },
    needsReview: false,
    reason: evidence,
  };
}
