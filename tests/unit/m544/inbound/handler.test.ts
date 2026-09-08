/**
 * Cloudflare inbound webhook handler — contract + flow tests on fakes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { createInboundWebhookHandler, type InboundDeps } from '@m544/inbound/handler';
import type { CampaignAdapter, CampaignInbox, CampaignMessageInput } from '@m544/inbound/campaign-adapter';
import { FakeEmailsRepo, FakeProfilesRepo, FakeStorageRepo } from '../_fakes/fake-repos';

const SECRET = 'hook-secret-abc';
const eml = fs.readFileSync(path.resolve(__dirname, '../../../fixtures/inbound/reply-with-pdf.eml'));

class FakeCampaigns implements CampaignAdapter {
  inboxes = new Map<string, CampaignInbox>();
  confirmed: Array<[string, string]> = [];
  messages: CampaignMessageInput[] = [];
  async findByInboxAddress(to: string) {
    return this.inboxes.get(to) ?? null;
  }
  async confirmParticipation(campaignId: string, from: string) {
    this.confirmed.push([campaignId, from]);
    return true;
  }
  async saveMessage(input: CampaignMessageInput) {
    this.messages.push(input);
  }
}

function makeDeps() {
  const emails = new FakeEmailsRepo();
  const profiles = new FakeProfilesRepo();
  const storage = new FakeStorageRepo();
  const campaigns = new FakeCampaigns();
  const deleted: string[] = [];
  const processed: string[] = [];
  const afterTasks: Array<() => Promise<void>> = [];
  const deps: InboundDeps = {
    emails,
    profiles,
    storage,
    campaigns,
    fetchRaw: vi.fn(async () => new Uint8Array(eml)),
    deleteRaw: async (k) => {
      deleted.push(k);
    },
    processEmail: async (id) => {
      processed.push(id);
    },
    after: (task) => {
      afterTasks.push(task);
    },
  };
  const runAfter = async () => {
    for (const t of afterTasks) await t();
  };
  return { deps, emails, profiles, storage, campaigns, deleted, processed, runAfter };
}

const payload = {
  from: 'Registratura Primaria <registratura@primaria-test.ro>',
  to: 'ion.popescu@implicarecivica.ro',
  subject: 'Re: Cerere informatii publice - Legea 544/2001',
  message_id: '<reply-1@primaria-test.ro>',
  in_reply_to: 'orig-1@implicarecivica.ro',
  references: '<orig-1@implicarecivica.ro>',
  r2_key: 'inbound/1-abc.eml',
  raw_size: 1228,
  received_at: '2026-09-08T10:00:00.000Z',
};

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

describe('user email flow', () => {
  it('stores the email with attachments, thread parent, then deletes raw and processes after the response', async () => {
    const { deps, emails, profiles, storage, deleted, processed, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: 'ion.popescu@implicarecivica.ro' });
    const sent = emails.seed({ user_id: 'u1', type: 'sent', message_id: 'orig-1@implicarecivica.ro' });

    const res = await createInboundWebhookHandler(() => deps)(post(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, matched: true, has_body: true, attachments: 2, has_parent: true, processing: 'triggered' });

    const stored = await emails.getById(body.email_id);
    expect(stored).toMatchObject({
      user_id: 'u1',
      type: 'received',
      parent_email_id: sent.id,
      message_id: 'reply-1@primaria-test.ro',
      from_email: payload.from,
      to_email: 'ion.popescu@implicarecivica.ro',
      subject: payload.subject,
      processing_status: 'pending',
      received_at: payload.received_at,
      pdf_file_path: `u1/${body.email_id}/confirmare.pdf`,
    });
    expect(stored?.body).toContain('<b>inregistrata</b>');
    expect(storage.files.has(`u1/${body.email_id}/confirmare.pdf`)).toBe(true);

    // Nothing deferred has run yet
    expect(deleted).toEqual([]);
    expect(processed).toEqual([]);
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml']);
    expect(processed).toEqual([body.email_id]);
  });

  it('unknown recipient → matched:false, nothing stored, raw kept', async () => {
    const { deps, emails, deleted, runAfter } = makeDeps();
    const res = await createInboundWebhookHandler(() => deps)(post(payload));
    expect(await res.json()).toEqual({ received: true, matched: false });
    expect(emails.rows.size).toBe(0);
    await runAfter();
    expect(deleted).toEqual([]);
  });

  it('duplicate message id → duplicate:true, no second row', async () => {
    const { deps, emails, profiles } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: 'ion.popescu@implicarecivica.ro' });
    const h = createInboundWebhookHandler(() => deps);
    await h(post(payload));
    const res = await h(post(payload));
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect([...emails.rows.values()].filter((e) => e.type === 'received')).toHaveLength(1);
  });

  it('processing failure after the response is logged, not thrown', async () => {
    const { deps, profiles, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: 'ion.popescu@implicarecivica.ro' });
    deps.processEmail = async () => {
      throw new Error('mistral down');
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createInboundWebhookHandler(() => deps)(post(payload));
    await expect(runAfter()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe('campaign flow', () => {
  it('subject equal to the campaign template → confirmed participation, raw NOT fetched, deleted after', async () => {
    const { deps, campaigns, deleted, runAfter } = makeDeps();
    campaigns.inboxes.set('parc@implicarecivica.ro', { id: 'c1', email_subject: 'Salvati parcul' });
    const res = await createInboundWebhookHandler(() => deps)(
      post({ ...payload, to: 'parc@implicarecivica.ro', subject: 'Fwd: Salvati parcul' }),
    );
    expect(await res.json()).toEqual({ received: true, campaign_counted: true, campaign_id: 'c1' });
    expect(campaigns.confirmed).toEqual([['c1', 'registratura@primaria-test.ro']]);
    expect(deps.fetchRaw).not.toHaveBeenCalled();
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml']);
  });

  it('other subject → message saved in the campaign inbox with attachments under campaign-<id>/', async () => {
    const { deps, campaigns, storage } = makeDeps();
    campaigns.inboxes.set('parc@implicarecivica.ro', { id: 'c1', email_subject: 'Salvati parcul' });
    const res = await createInboundWebhookHandler(() => deps)(post({ ...payload, to: 'parc@implicarecivica.ro', subject: 'Intrebare' }));
    expect(await res.json()).toEqual({ received: true, campaign_message_saved: true, campaign_id: 'c1' });
    expect(campaigns.messages).toHaveLength(1);
    const msg = campaigns.messages[0];
    expect(msg).toMatchObject({ campaignId: 'c1', fromEmail: 'registratura@primaria-test.ro', fromName: 'Registratura Primaria', subject: 'Intrebare' });
    expect(msg.attachments.map((a) => a.path.split('/')[0])).toEqual(['campaign-c1', 'campaign-c1']);
    expect(storage.files.size).toBe(2);
  });
});
