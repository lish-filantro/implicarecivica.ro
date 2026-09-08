/**
 * Strategy 1 — thread: the received email replies to one of our emails
 * (parent_email_id) that is already linked to a request.
 */
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { MatchableEmail, MatchResult } from '@m544/pipeline/types';

export async function matchByThread(
  email: Pick<MatchableEmail, 'parent_email_id'>,
  emails: EmailsRepo,
): Promise<MatchResult | null> {
  if (!email.parent_email_id) return null;
  const requestId = await emails.getRequestIdOfEmail(email.parent_email_id);
  return requestId ? { requestId, strategy: 'thread', confidence: 'high' } : null;
}
