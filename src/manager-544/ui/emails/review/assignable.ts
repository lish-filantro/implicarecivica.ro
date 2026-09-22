/**
 * Pure helpers behind "atribuie emailul unei întrebări".
 *
 * A session groups the questions sent to one institution on one subject, and
 * each question carries its own registration number and deadline. The user
 * thinks in exactly those terms ("e prelungire la întrebarea nr. 4521"), so the
 * selects mirror the model: session first, then the question inside it.
 *
 * The session is only ever *suggested* from the sender's address — never
 * auto-applied — because an institution answering from an unexpected mailbox is
 * precisely the case that lands here.
 */
import type { AssignableRequest } from '@m544/requests/queries.client';
import { getStatusLabel } from '@m544/requests/utils/labels';
import { extractEmailAddr } from '@m544/pipeline/matching/normalize';

export interface SessionGroup {
  /** Stable select value; a session-less request stands alone under `request:<id>`. */
  key: string;
  label: string;
  requests: AssignableRequest[];
}

export function groupBySession(requests: AssignableRequest[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  const byKey = new Map<string, SessionGroup>();

  for (const request of requests) {
    const key = request.session_id ?? `request:${request.id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: request.session_label, requests: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.requests.push(request);
  }

  return groups;
}

const dateFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });

function deadlineLabel(request: AssignableRequest): string | null {
  // Effective deadline: the extension replaces the standard one once granted.
  const effective = request.extension_date ?? request.deadline_date;
  return effective ? `termen ${dateFormat.format(new Date(effective))}` : null;
}

/** "nr. 4521 — Lista contractelor — termen 3 oct. — Înregistrată" */
export function questionLabel(request: AssignableRequest): string {
  return [
    request.registration_number ? `nr. ${request.registration_number}` : 'fără număr',
    request.subject,
    deadlineLabel(request),
    getStatusLabel(request.status),
  ]
    .filter(Boolean)
    .join(' — ');
}

const domainOf = (address: string): string => address.split('@')[1] ?? '';

/**
 * The session the sender most likely writes about: an exact institution address
 * first, then any mailbox on the same domain. Null when nothing matches.
 */
export function guessSessionKey(groups: SessionGroup[], fromEmail: string): string | null {
  const sender = extractEmailAddr(fromEmail || '');
  if (!sender.includes('@')) return null;

  const addresses = (group: SessionGroup): string[] =>
    group.requests.map((r) => (r.institution_email ? extractEmailAddr(r.institution_email) : '')).filter(Boolean);

  const exact = groups.find((g) => addresses(g).includes(sender));
  if (exact) return exact.key;

  const senderDomain = domainOf(sender);
  const sameDomain = groups.find((g) => addresses(g).some((a) => domainOf(a) === senderDomain));
  return sameDomain?.key ?? null;
}
