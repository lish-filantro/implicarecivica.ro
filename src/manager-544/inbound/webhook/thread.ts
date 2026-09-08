/**
 * Thread detection: link an inbound email to the email of ours it replies to,
 * via the In-Reply-To and References headers. The parent's request_id is the
 * strongest matching signal the pipeline has.
 */
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import { stripAngleBrackets } from './addresses';

/** In-Reply-To first, then References left→right; brackets removed; no duplicates. */
export function candidateMessageIds(inReplyTo?: string | null, references?: string | null): string[] {
  const ids: string[] = [];
  const push = (raw: string) => {
    const id = stripAngleBrackets(raw);
    if (id && !ids.includes(id)) ids.push(id);
  };
  if (inReplyTo) push(inReplyTo);
  if (references) references.split(/\s+/).forEach(push);
  return ids;
}

export async function detectParentEmail(
  headers: { inReplyTo?: string | null; references?: string | null },
  emails: EmailsRepo,
): Promise<string | null> {
  for (const messageId of candidateMessageIds(headers.inReplyTo, headers.references)) {
    const parentId = await emails.findIdByMessageId(messageId);
    if (parentId) return parentId;
  }
  return null;
}
