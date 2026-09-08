/**
 * Pure string helpers used by the matching strategies.
 * Behaviour is identical to the legacy lib/services/request-matching.ts
 * (covered by tests/unit/pure-functions.test.ts and matching/normalize.test.ts).
 */

/**
 * Numeric core of a registration number (at least 3 digits), or null.
 *   "29702/14.11.2025"       → "29702"
 *   "Nr. 31884 / 01.12.2025" → "31884"
 *   "12"                     → null
 */
export function extractRegNumberCore(reg: string): string | null {
  const cleaned = reg.replace(/^nr\.?\s*/i, '').trim();
  const match = cleaned.match(/^(\d+)/);
  return match && match[1].length >= 3 ? match[1] : null;
}

/** Strip up to two leading Re:/Fwd:/Fw:/Răspuns: prefixes, trim, lowercase. */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?|răspuns)\s*:\s*/gi, '')
    .replace(/^(re|fwd?|răspuns)\s*:\s*/gi, '')
    .trim()
    .toLowerCase();
}

/** Bare, lowercased address from an RFC 5322 mailbox: "Ion <ion@x.ro>" → "ion@x.ro". */
export function extractEmailAddr(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}
