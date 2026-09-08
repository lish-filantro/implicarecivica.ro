/**
 * Svix webhook signature verification (Resend delivers webhooks through Svix).
 * https://docs.svix.com/receiving/verifying-payloads/how-manual
 *
 * Pure function: headers + raw body + secret + clock in, verdict out.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixVerdict = { ok: true } | { ok: false; reason: string };

type HeaderMap = Record<string, string | undefined> | { get(name: string): string | null };

function header(headers: HeaderMap, name: string): string | undefined {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(name: string): string | null }).get(name) ?? undefined;
  }
  const map = headers as Record<string, string | undefined>;
  const key = Object.keys(map).find((k) => k.toLowerCase() === name);
  return key ? map[key] : undefined;
}

function decodeSecret(secret: string): Buffer {
  const base64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(base64, 'base64');
}

export function verifySvixSignature(
  headers: HeaderMap,
  rawBody: string,
  secret: string,
  now: () => Date = () => new Date(),
): SvixVerdict {
  const id = header(headers, 'svix-id');
  const timestamp = header(headers, 'svix-timestamp');
  const signatures = header(headers, 'svix-signature');
  if (!id || !timestamp || !signatures) return { ok: false, reason: 'missing svix headers' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };
  const skew = Math.abs(Math.floor(now().getTime() / 1000) - ts);
  if (skew > SVIX_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp outside tolerance' };

  const expected = createHmac('sha256', decodeSecret(secret)).update(`${id}.${timestamp}.${rawBody}`).digest();

  const candidates = signatures
    .split(/\s+/)
    .map((entry) => entry.split(','))
    .filter(([version, value]) => version === 'v1' && !!value)
    .map(([, value]) => Buffer.from(value, 'base64'));

  if (candidates.length === 0) return { ok: false, reason: 'no v1 signature' };

  const matched = candidates.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}
