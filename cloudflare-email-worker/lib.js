/**
 * Pure helpers for the Email Worker (no Cloudflare bindings) so they can be
 * unit-tested from the main repo (tests/unit/worker/lib.test.ts).
 *
 * The same envelope is (1) stored as R2 customMetadata next to the raw MIME
 * and (2) posted to the Next.js webhook. If the webhook call fails, the
 * reconcile cron rebuilds the payload from the metadata alone.
 */

export const SUBJECT_MAX = 500;
export const REFERENCES_MAX = 1000;
export const ADDRESS_MAX = 320;
export const ID_MAX = 255;
/** Conservative budget for the whole customMetadata record (R2/S3 caps user metadata at ~2 KiB). */
export const METADATA_BUDGET_BYTES = 2000;

/** "<abc@def>" → "abc@def" */
export function stripAngleBrackets(value) {
  return String(value ?? '').replace(/[<>]/g, '').trim();
}

export function truncate(value, max) {
  const s = String(value ?? '');
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Envelope of the inbound email: plain strings (truncated) + `raw_size` number.
 * `headers` is Headers-like (`get(name)`), as on a Cloudflare EmailMessage.
 * @param {{ from: string, to: string, headers: { get(name: string): string | null } | null | undefined, rawSize: number | undefined, receivedAt: string }} input
 */
export function buildMetadata({ from, to, headers, rawSize, receivedAt }) {
  const get = (name) => (headers && typeof headers.get === 'function' ? headers.get(name) : null) || '';
  return {
    from: truncate(from, ADDRESS_MAX),
    to: truncate(to, ADDRESS_MAX),
    subject: truncate(get('subject').trim() || '(fără subiect)', SUBJECT_MAX),
    message_id: truncate(stripAngleBrackets(get('message-id')), ID_MAX),
    in_reply_to: truncate(stripAngleBrackets(get('in-reply-to')), ID_MAX),
    references: truncate(get('references').trim(), REFERENCES_MAX),
    received_at: receivedAt || new Date().toISOString(),
    raw_size: Number(rawSize) || 0,
  };
}

/**
 * Metadata values travel as HTTP headers through the S3 API, which only
 * carries printable ASCII. Everything else (and `%` itself) is percent-encoded
 * so `decodeURIComponent` on the reader side is lossless; plain ASCII stays readable.
 */
export function encodeMetaValue(value) {
  return String(value ?? '').replace(/[^\x21-\x7e ]|%/g, (c) => encodeURIComponent(c));
}

/** R2 customMetadata record: every value a string, encoded, within the size budget. */
export function toCustomMetadata(metadata, budget = METADATA_BUDGET_BYTES) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(metadata)) out[key] = encodeMetaValue(value);
  const size = (rec) => Object.entries(rec).reduce((n, [k, v]) => n + k.length + v.length, 0);
  // Shrink the least important fields first until the record fits.
  for (const field of ['references', 'subject', 'from']) {
    while (size(out) > budget && out[field].length > 0) {
      out[field] = out[field].slice(0, Math.max(0, Math.floor(out[field].length / 2)));
    }
  }
  return out;
}

/** JSON body for POST /api/webhooks/cloudflare-email. */
export function buildPayload(metadata, r2Key) {
  return { ...metadata, r2_key: r2Key };
}

export function newR2Key(now = Date.now(), uuid = crypto.randomUUID()) {
  return `inbound/${now}-${uuid}.eml`;
}
