/**
 * inbound/resend/signature — Svix webhook signature verification (used by Resend).
 *
 * Scheme: signed_content = `${svix-id}.${svix-timestamp}.${raw body}`;
 * key = base64-decoded secret after the `whsec_` prefix; HMAC-SHA256, base64;
 * header `svix-signature` holds one or more `v1,<base64>` entries separated by spaces.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySvixSignature, SVIX_TOLERANCE_SECONDS } from '@m544/inbound/resend/signature';

const rawKey = Buffer.from('0123456789abcdef0123456789abcdef');
const secret = `whsec_${rawKey.toString('base64')}`;
const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'abc' } });
const id = 'msg_2abc';
const nowSec = 1_800_000_000;

function sign(ts: number, key: Buffer = rawKey, payload = body) {
  return createHmac('sha256', key).update(`${id}.${ts}.${payload}`).digest('base64');
}
function headers(ts: number, sig: string) {
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` };
}
const now = () => new Date(nowSec * 1000);

describe('verifySvixSignature', () => {
  it('accepts a valid signature within tolerance', () => {
    expect(verifySvixSignature(headers(nowSec - 10, sign(nowSec - 10)), body, secret, now)).toEqual({ ok: true });
  });

  it('accepts when any of several signatures matches (key rotation)', () => {
    const h = { ...headers(nowSec, sign(nowSec)), 'svix-signature': `v1,bogus= v1,${sign(nowSec)}` };
    expect(verifySvixSignature(h, body, secret, now).ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const r = verifySvixSignature(headers(nowSec, sign(nowSec)), body + ' ', secret, now);
    expect(r).toEqual({ ok: false, reason: 'signature mismatch' });
  });

  it('rejects a signature made with another key', () => {
    const r = verifySvixSignature(headers(nowSec, sign(nowSec, Buffer.from('another-key-another-key-another!'))), body, secret, now);
    expect(r.ok).toBe(false);
  });

  it('rejects timestamps outside the tolerance window (replay protection)', () => {
    const old = nowSec - SVIX_TOLERANCE_SECONDS - 1;
    expect(verifySvixSignature(headers(old, sign(old)), body, secret, now)).toEqual({ ok: false, reason: 'timestamp outside tolerance' });
    const future = nowSec + SVIX_TOLERANCE_SECONDS + 1;
    expect(verifySvixSignature(headers(future, sign(future)), body, secret, now).ok).toBe(false);
  });

  it('rejects missing or malformed headers', () => {
    expect(verifySvixSignature({}, body, secret, now)).toEqual({ ok: false, reason: 'missing svix headers' });
    expect(verifySvixSignature({ ...headers(nowSec, sign(nowSec)), 'svix-timestamp': 'abc' }, body, secret, now).ok).toBe(false);
    expect(verifySvixSignature({ ...headers(nowSec, sign(nowSec)), 'svix-signature': 'v2,zzz' }, body, secret, now).ok).toBe(false);
  });

  it('accepts the secret with or without the whsec_ prefix', () => {
    expect(verifySvixSignature(headers(nowSec, sign(nowSec)), body, rawKey.toString('base64'), now).ok).toBe(true);
  });

  it('is case-insensitive on header names', () => {
    const h = headers(nowSec, sign(nowSec));
    const upper = { 'Svix-Id': h['svix-id'], 'Svix-Timestamp': h['svix-timestamp'], 'Svix-Signature': h['svix-signature'] };
    expect(verifySvixSignature(upper, body, secret, now).ok).toBe(true);
  });
});
