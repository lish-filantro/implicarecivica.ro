/**
 * Cloudflare inbound webhook handler — HTTP contract (auth, validation, JSON shape).
 * The ingestion flows themselves are covered in ingest.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createInboundWebhookHandler, toResponseBody } from '@m544/inbound/handler';
import { makeDeps, payload } from './_fakes';

const SECRET = 'hook-secret-abc';

function post(body: unknown, auth: string | null = `Bearer ${SECRET}`) {
  return new NextRequest('http://localhost/api/webhooks/cloudflare-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = SECRET;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe('auth and validation', () => {
  it('401 without/with wrong secret; 500 when the secret is not configured', async () => {
    const { deps } = makeDeps();
    const h = createInboundWebhookHandler(() => deps);
    expect((await h(post(payload, null))).status).toBe(401);
    expect((await h(post(payload, 'Bearer nope'))).status).toBe(401);
    delete process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
    const res = await h(post(payload, 'Bearer anything'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/misconfigur/i);
    expect(deps.fetchRaw).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON or payload', async () => {
    const { deps } = makeDeps();
    const h = createInboundWebhookHandler(() => deps);
    expect((await h(post('{bad'))).status).toBe(400);
    expect((await h(post({ from: 'a@b.ro' }))).status).toBe(400);
    expect((await h(post({ ...payload, r2_key: '../x' }))).status).toBe(400);
  });
});

describe('toResponseBody', () => {
  it('maps every ingest result to the stable JSON keys', () => {
    expect(toResponseBody({ kind: 'campaign_counted', campaign_id: 'c1' })).toEqual({ campaign_counted: true, campaign_id: 'c1' });
    expect(toResponseBody({ kind: 'campaign_message_saved', campaign_id: 'c1' })).toEqual({ campaign_message_saved: true, campaign_id: 'c1' });
    expect(toResponseBody({ kind: 'no_user', to_email: 'x@y.ro' })).toEqual({ matched: false });
    expect(toResponseBody({ kind: 'duplicate', message_id: 'm' })).toEqual({ duplicate: true });
    expect(toResponseBody({ kind: 'ingested', email_id: 'e1', attachments: 2, has_parent: true, has_body: false })).toEqual({
      matched: true,
      email_id: 'e1',
      has_body: false,
      attachments: 2,
      has_parent: true,
      processing: 'triggered',
    });
  });
});

describe('end to end through HTTP', () => {
  it('200 with received:true + ingested fields; deferred work runs only after the response', async () => {
    const { deps, profiles, deleted, processed, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: 'ion.popescu@implicarecivica.ro' });
    const res = await createInboundWebhookHandler(() => deps)(post(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, matched: true, has_body: true, attachments: 2, has_parent: false, processing: 'triggered' });
    expect(deleted).toEqual([]);
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml']);
    expect(processed).toEqual([body.email_id]);
  });

  it('unknown recipient → { received: true, matched: false }', async () => {
    const { deps } = makeDeps();
    const res = await createInboundWebhookHandler(() => deps)(post(payload));
    expect(await res.json()).toEqual({ received: true, matched: false });
  });

  it('campaign confirmation → { received: true, campaign_counted: true, campaign_id }', async () => {
    const { deps, campaigns } = makeDeps();
    campaigns.inboxes.set('parc@implicarecivica.ro', { id: 'c1', email_subject: 'Salvati parcul' });
    const res = await createInboundWebhookHandler(() => deps)(post({ ...payload, to: 'parc@implicarecivica.ro', subject: 'Re: Salvati parcul' }));
    expect(await res.json()).toEqual({ received: true, campaign_counted: true, campaign_id: 'c1' });
  });
});
