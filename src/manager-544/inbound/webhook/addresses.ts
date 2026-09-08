/**
 * RFC 5322 address helpers shared by the inbound webhooks.
 */

/** "Ion Popescu <ion@x.ro>" → "ion@x.ro"; bare addresses are trimmed and lowercased. */
export function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

/** "Ion Popescu <ion@x.ro>" → "Ion Popescu"; null when there is no display name. */
export function extractName(raw: string): string | null {
  const match = raw.match(/^(.+?)\s*<[^>]+>/);
  if (!match) return null;
  const name = match[1].replace(/^["']|["']$/g, '').trim();
  return name.length > 0 ? name : null;
}

/** "<abc@def>" → "abc@def" (Message-ID normalization). */
export function stripAngleBrackets(value: string): string {
  return value.replace(/[<>]/g, '').trim();
}

/** Remove leading Re:/Fwd:/FW: prefixes (repeatedly) for template comparison. */
export function cleanReplySubject(subject: string | null | undefined): string {
  if (!subject) return '';
  let s = subject.trim();
  const prefix = /^(re|fwd?|fw)\s*:\s*/i;
  while (prefix.test(s)) s = s.replace(prefix, '');
  return s.trim();
}
