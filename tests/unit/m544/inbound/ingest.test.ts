/**
 * inbound/ingest — the campaign / user flows on fakes, independent of HTTP.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ingestEnvelope } from '@m544/inbound/ingest';
import { createLogger } from '@m544/shared/log';
import { makeDeps, envelope } from './_fakes';

const RECIPIENT = 'ion.popescu@implicarecivica.ro';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('user email flow', () => {
  it('ingested: stores the email with attachments + thread parent, defers raw delete and processing', async () => {
    const { deps, emails, profiles, storage, deleted, processed, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: RECIPIENT });
    const sent = emails.seed({ user_id: 'u1', type: 'sent', message_id: 'orig-1@implicarecivica.ro' });

    const result = await ingestEnvelope(envelope(), deps);
    expect(result).toMatchObject({ kind: 'ingested', attachments: 2, has_parent: true, has_body: true });
    if (result.kind !== 'ingested') return;

    const stored = await emails.getById(result.email_id);
    expect(stored).toMatchObject({
      user_id: 'u1',
      type: 'received',
      parent_email_id: sent.id,
      message_id: 'reply-1@primaria-test.ro',
      to_email: RECIPIENT,
      processing_status: 'pending',
      received_at: '2026-09-08T10:00:00.000Z',
      pdf_file_path: `u1/${result.email_id}/confirmare.pdf`,
    });
    expect(stored?.body).toContain('<b>inregistrata</b>');
    expect(storage.files.has(`u1/${result.email_id}/confirmare.pdf`)).toBe(true);

    expect(deleted).toEqual([]);
    expect(processed).toEqual([]);
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml']);
    expect(processed).toEqual([result.email_id]);
  });

  it('no_user: nothing stored, raw NOT fetched nor deleted, warning logged', async () => {
    const { deps, emails, deleted, runAfter } = makeDeps();
    const lines: string[] = [];
    deps.log = createLogger({ production: false, console: { log: () => {}, warn: (l: string) => lines.push(l), error: () => {} } });

    const result = await ingestEnvelope(envelope(), deps);
    expect(result).toEqual({ kind: 'no_user', to_email: RECIPIENT });
    expect(emails.rows.size).toBe(0);
    expect(deps.fetchRaw).not.toHaveBeenCalled();
    await runAfter();
    expect(deleted).toEqual([]);
    expect(lines[0]).toMatch(/^\[warn\] inbound\.no_user to=ion\.popescu@implicarecivica\.ro/);
  });

  it('duplicate: no second row, raw deleted after', async () => {
    const { deps, emails, profiles, deleted, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: RECIPIENT });
    await ingestEnvelope(envelope(), deps);
    const result = await ingestEnvelope(envelope(), deps);
    expect(result).toEqual({ kind: 'duplicate', message_id: 'reply-1@primaria-test.ro' });
    expect([...emails.rows.values()].filter((e) => e.type === 'received')).toHaveLength(1);
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml', 'inbound/1-abc.eml']);
  });

  it('processing failure inside after() is logged, not thrown', async () => {
    const { deps, profiles, runAfter } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: RECIPIENT });
    deps.processEmail = async () => {
      throw new Error('mistral down');
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await ingestEnvelope(envelope(), deps);
    await expect(runAfter()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('inbound.process_failed'));
  });

  it('immediate `after` (reconcile mode): side effects complete before the result is returned', async () => {
    const { deps, profiles, deleted, processed } = makeDeps();
    profiles.seed({ id: 'u1', mailcow_email: RECIPIENT });
    deps.after = (task) => task();
    const result = await ingestEnvelope(envelope(), deps);
    expect(result.kind).toBe('ingested');
    expect(deleted).toEqual(['inbound/1-abc.eml']);
    expect(processed).toHaveLength(1);
  });
});

describe('campaign flow', () => {
  it('subject equal to the template → campaign_counted, raw NOT fetched, deleted after', async () => {
    const { deps, campaigns, deleted, runAfter } = makeDeps();
    campaigns.inboxes.set('parc@implicarecivica.ro', { id: 'c1', email_subject: 'Salvati parcul' });
    const result = await ingestEnvelope(envelope({ to: 'parc@implicarecivica.ro', subject: 'Fwd: Salvati parcul' }), deps);
    expect(result).toEqual({ kind: 'campaign_counted', campaign_id: 'c1' });
    expect(campaigns.confirmed).toEqual([['c1', 'registratura@primaria-test.ro']]);
    expect(deps.fetchRaw).not.toHaveBeenCalled();
    await runAfter();
    expect(deleted).toEqual(['inbound/1-abc.eml']);
  });

  it('other subject → campaign_message_saved with attachments under campaign-<id>/', async () => {
    const { deps, campaigns, storage } = makeDeps();
    campaigns.inboxes.set('parc@implicarecivica.ro', { id: 'c1', email_subject: 'Salvati parcul' });
    const result = await ingestEnvelope(envelope({ to: 'parc@implicarecivica.ro', subject: 'Intrebare' }), deps);
    expect(result).toEqual({ kind: 'campaign_message_saved', campaign_id: 'c1' });
    const msg = campaigns.messages[0];
    expect(msg).toMatchObject({ campaignId: 'c1', fromEmail: 'registratura@primaria-test.ro', fromName: 'Registratura Primaria', subject: 'Intrebare' });
    expect(msg.attachments.map((a) => a.path.split('/')[0])).toEqual(['campaign-c1', 'campaign-c1']);
    expect(storage.files.size).toBe(2);
  });
});
