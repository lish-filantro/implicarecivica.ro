/**
 * Resend webhook handler — signature enforced, delivery events only.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createResendWebhookHandler } from '@m544/inbound/resend/handler';
import { FakeEmailsRepo } from '../_fakes/fake-repos';

const rawKey = Buffer.from('0123456789abcdef0123456789abcdef');
const SECRET = `whsec_${rawKey.toString('base64')}`;
const NOW = 1_800_000_000;
const now = () => new Date(NOW * 1000);

function signed(body: unknown, opts: { key?: Buffer; ts?: number } = {}) {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? NOW;
  const sig = createHmac('sha256', opts.key ?? rawKey).update(`msg_1.${ts}.${raw}`).digest('base64');
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` },
    body: raw,
  });
}

beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe('Resend webhook', () => {
  it('rejects unsigned or badly signed requests with 401', async () => {
    const emails = new FakeEmailsRepo();
    const h = createResendWebhookHandler(() => ({ emails, now }));
    const unsigned = new NextRequest('http://localhost/api/webhooks/resend', { method: 'POST', body: '{"type":"ping"}' });
    expect((await h(unsigned)).status).toBe(401);
    expect((await h(signed({ type: 'ping' }, { key: Buffer.from('wrong-key-wrong-key-wrong-key-00') }))).status).toBe(401);
    expect((await h(signed({ type: 'ping' }, { ts: NOW - 3600 }))).status).toBe(401);
  });

  it('500 misconfigured when RESEND_WEBHOOK_SECRET is missing or a placeholder', async () => {
    const emails = new FakeEmailsRepo();
    const h = createResendWebhookHandler(() => ({ emails, now }));
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await h(signed({ type: 'ping' }))).status).toBe(500);
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_placeholder';
    expect((await h(signed({ type: 'ping' }))).status).toBe(500);
  });

  it('acknowledges but ignores email.received (inbound is Cloudflare)', async () => {
    const emails = new FakeEmailsRepo();
    const res = await createResendWebhookHandler(() => ({ emails, now }))(
      signed({ type: 'email.received', data: { from: 'x@y.ro', to: ['u@implicarecivica.ro'], subject: 'hi', html: '<b>x</b>' } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toMatch(/Cloudflare/);
    expect(emails.rows.size).toBe(0);
  });

  it('marks a sent email delivered / bounced by Resend message id', async () => {
    const emails = new FakeEmailsRepo();
    const sent = emails.seed({ user_id: 'u1', type: 'sent', message_id: 're_123', processing_status: 'completed' });
    const h = createResendWebhookHandler(() => ({ emails, now }));

    const bounced = await h(signed({ type: 'email.bounced', data: { email_id: 're_123', bounce: { type: 'hard' } } }));
    expect(await bounced.json()).toEqual({ received: true, matched: true, status: 'failed' });
    expect((await emails.getById(sent.id))?.error_log).toBe('Bounce: hard');

    const delivered = await h(signed({ type: 'email.delivered', data: { email_id: 're_123' } }));
    expect(await delivered.json()).toEqual({ received: true, matched: true, status: 'completed' });
    expect((await emails.getById(sent.id))?.error_log).toBeNull();
  });

  it('unknown message id → matched:false; unknown type → unhandled; bad body → 400', async () => {
    const emails = new FakeEmailsRepo();
    const h = createResendWebhookHandler(() => ({ emails, now }));
    expect(await (await h(signed({ type: 'email.delivered', data: { email_id: 'nope' } }))).json()).toEqual({ received: true, matched: false });
    expect(await (await h(signed({ type: 'email.opened', data: { email_id: 'x' } }))).json()).toEqual({ received: true, unhandled: 'email.opened' });
    expect((await h(signed({ nope: true }))).status).toBe(400);
  });
});
