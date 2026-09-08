/**
 * inbound/webhook/payload — validation of the JSON the Cloudflare Email Worker posts.
 */
import { describe, it, expect } from 'vitest';
import { parseWorkerPayload, workerPayloadSchema } from '@m544/inbound/webhook/payload';

const valid = {
  from: 'Registratura <registratura@primaria.ro>',
  to: 'ion.popescu@implicarecivica.ro',
  subject: 'Re: Cerere informații publice - Legea 544/2001',
  message_id: 'abc123@primaria.ro',
  in_reply_to: 'orig@implicarecivica.ro',
  references: '<orig@implicarecivica.ro> <x@y>',
  r2_key: 'inbound/1700000000000-uuid.eml',
  raw_size: 12345,
  received_at: '2026-09-08T10:00:00.000Z',
};

describe('workerPayloadSchema', () => {
  it('accepts the worker payload', () => {
    expect(workerPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('requires from, to and r2_key', () => {
    for (const key of ['from', 'to', 'r2_key'] as const) {
      const bad = { ...valid, [key]: undefined };
      expect(workerPayloadSchema.safeParse(bad).success, key).toBe(false);
    }
  });

  it('rejects an r2_key outside the inbound/ prefix or with path traversal', () => {
    expect(workerPayloadSchema.safeParse({ ...valid, r2_key: '../secrets' }).success).toBe(false);
    expect(workerPayloadSchema.safeParse({ ...valid, r2_key: 'other/x.eml' }).success).toBe(false);
  });

  it('treats optional header fields as optional', () => {
    const minimal = { from: valid.from, to: valid.to, r2_key: valid.r2_key };
    const parsed = workerPayloadSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
  });
});

describe('parseWorkerPayload', () => {
  it('normalizes: subject fallback, message_id fallback to a generated id, in_reply_to without brackets', () => {
    const p = parseWorkerPayload({ from: valid.from, to: valid.to, r2_key: valid.r2_key, in_reply_to: '<x@y.ro>' });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data.subject).toBe('(fără subiect)');
    expect(p.data.message_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.data.in_reply_to).toBe('x@y.ro');
    expect(p.data.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.data.to_email).toBe('ion.popescu@implicarecivica.ro');
    expect(p.data.from_email).toBe('registratura@primaria.ro');
  });

  it('keeps the original values when present', () => {
    const p = parseWorkerPayload(valid);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data.message_id).toBe('abc123@primaria.ro');
    expect(p.data.subject).toBe(valid.subject);
    expect(p.data.raw_size).toBe(12345);
  });

  it('returns the zod issues on invalid input', () => {
    const p = parseWorkerPayload({ from: 'x' });
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.error).toMatch(/to/);
    expect(p.error).toMatch(/r2_key/);
  });
});
