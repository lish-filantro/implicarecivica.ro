/**
 * cloudflare-email-worker/lib — envelope/metadata helpers shared by the worker
 * and (in spirit) by the reconcile cron that rebuilds payloads from R2 metadata.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMetadata,
  buildPayload,
  toCustomMetadata,
  encodeMetaValue,
  stripAngleBrackets,
  newR2Key,
  SUBJECT_MAX,
  REFERENCES_MAX,
} from '../../../cloudflare-email-worker/lib.js';

const headers = (map: Record<string, string>) => ({ get: (name: string) => map[name.toLowerCase()] ?? null });

const input = {
  from: 'Registratura <registratura@primaria.ro>',
  to: 'ion.popescu@implicarecivica.ro',
  headers: headers({
    subject: '  Re: Cerere informații  ',
    'message-id': '<abc@primaria.ro>',
    'in-reply-to': '<orig@implicarecivica.ro>',
    references: '<orig@implicarecivica.ro> <x@y>',
  }),
  rawSize: 1234,
  receivedAt: '2026-09-08T10:00:00.000Z',
};

describe('buildMetadata', () => {
  it('normalises the envelope: trimmed subject, ids without <>, numeric raw_size', () => {
    expect(buildMetadata(input)).toEqual({
      from: input.from,
      to: input.to,
      subject: 'Re: Cerere informații',
      message_id: 'abc@primaria.ro',
      in_reply_to: 'orig@implicarecivica.ro',
      references: '<orig@implicarecivica.ro> <x@y>',
      received_at: '2026-09-08T10:00:00.000Z',
      raw_size: 1234,
    });
  });

  it('falls back for missing headers and size', () => {
    const m = buildMetadata({ from: 'a@b.ro', to: 'c@d.ro', headers: headers({}), rawSize: undefined, receivedAt: '' });
    expect(m.subject).toBe('(fără subiect)');
    expect(m.message_id).toBe('');
    expect(m.in_reply_to).toBe('');
    expect(m.references).toBe('');
    expect(m.raw_size).toBe(0);
    expect(m.received_at).toMatch(/^\d{4}-/);
  });

  it('truncates subject to 500 and references to 1000 characters', () => {
    const m = buildMetadata({
      ...input,
      headers: headers({ subject: 'S'.repeat(700), references: 'R'.repeat(1500) }),
    });
    expect(m.subject).toHaveLength(SUBJECT_MAX);
    expect(m.references).toHaveLength(REFERENCES_MAX);
  });
});

describe('stripAngleBrackets / encodeMetaValue', () => {
  it('removes brackets and trims', () => {
    expect(stripAngleBrackets(' <a@b> ')).toBe('a@b');
    expect(stripAngleBrackets(null)).toBe('');
  });

  it('keeps printable ASCII, percent-encodes the rest losslessly', () => {
    const encoded = encodeMetaValue('Cerere informații 100% <x@y>');
    expect(encoded).toBe('Cerere informa%C8%9Bii 100%25 <x@y>');
    expect(decodeURIComponent(encoded)).toBe('Cerere informații 100% <x@y>');
  });
});

describe('toCustomMetadata', () => {
  it('stringifies and encodes every value', () => {
    const rec = toCustomMetadata(buildMetadata(input));
    expect(rec.raw_size).toBe('1234');
    expect(rec.subject).toBe('Re: Cerere informa%C8%9Bii');
    expect(Object.values(rec).every((v) => typeof v === 'string')).toBe(true);
  });

  it('shrinks references, then subject, to stay within the byte budget', () => {
    const big = buildMetadata({ ...input, headers: headers({ subject: 'S'.repeat(500), references: 'R'.repeat(1000) }) });
    const rec = toCustomMetadata(big, 800);
    const total = Object.entries(rec).reduce((n, [k, v]) => n + k.length + v.length, 0);
    expect(total).toBeLessThanOrEqual(800);
    expect(rec.references.length).toBeLessThan(rec.subject.length);
    expect(rec.from).toBe(input.from);
    expect(rec.to).toBe(input.to);
  });
});

describe('buildPayload / newR2Key', () => {
  it('adds r2_key to the envelope', () => {
    const m = buildMetadata(input);
    expect(buildPayload(m, 'inbound/1-abc.eml')).toEqual({ ...m, r2_key: 'inbound/1-abc.eml' });
  });

  it('generates keys the webhook accepts (inbound/<ts>-<uuid>.eml)', () => {
    expect(newR2Key(1700000000000, 'uuid-1')).toBe('inbound/1700000000000-uuid-1.eml');
    expect(newR2Key()).toMatch(/^inbound\/\d+-[0-9a-f-]{36}\.eml$/);
  });
});
