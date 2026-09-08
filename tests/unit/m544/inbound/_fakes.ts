/**
 * Fakes shared by the inbound tests: a campaign adapter, a full InboundDeps
 * with recorded side effects, a sample worker payload and its envelope.
 */
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import type { InboundDeps } from '@m544/inbound/ingest';
import type { CampaignAdapter, CampaignInbox, CampaignMessageInput } from '@m544/inbound/campaign-adapter';
import { parseWorkerPayload, type InboundEnvelope } from '@m544/inbound/webhook/payload';
import { FakeEmailsRepo, FakeProfilesRepo, FakeStorageRepo } from '../_fakes/fake-repos';

export const eml = fs.readFileSync(path.resolve(__dirname, '../../../fixtures/inbound/reply-with-pdf.eml'));

export class FakeCampaigns implements CampaignAdapter {
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

export const payload = {
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

export function envelope(overrides: Partial<typeof payload> = {}): InboundEnvelope {
  const parsed = parseWorkerPayload({ ...payload, ...overrides });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

/** Deferred `after` tasks are collected and run by `runAfter()` (webhook mode). */
export function makeDeps() {
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
