/**
 * inbound/reconcile/reconcile — age windows, envelope rebuild, counting, error isolation.
 */
import { describe, it, expect, vi } from 'vitest';
import { reconcileInbound, envelopeFromMetadata, type ReconcileDeps } from '@m544/inbound/reconcile/reconcile';
import type { IngestResult } from '@m544/inbound/ingest';
import type { R2ObjectInfo } from '@m544/inbound/reconcile/r2-list';
import { createLogger } from '@m544/shared/log';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const fullMeta = {
  from: 'Registratura <registratura@primaria.ro>',
  to: 'ion.popescu@implicarecivica.ro',
  subject: 'Re: Cerere',
  message_id: 'm1@primaria.ro',
  in_reply_to: '',
  references: '',
  received_at: '2026-09-08T09:00:00.000Z',
  raw_size: '1228',
};

function harness(objects: R2ObjectInfo[], metas: Record<string, Record<string, string> | Error>, results: Record<string, IngestResult | Error>) {
  const ingested: string[] = [];
  const logged: string[] = [];
  const log = createLogger({
    production: true,
    console: { log: (l: string) => logged.push(l), warn: (l: string) => logged.push(l), error: (l: string) => logged.push(l) },
  });
  const deps: ReconcileDeps = {
    list: async () => objects,
    head: async (key) => {
      const m = metas[key];
      if (m instanceof Error) throw m;
      return m ?? fullMeta;
    },
    ingest: async (env) => {
      ingested.push(env.r2_key);
      const r = results[env.r2_key];
      if (r instanceof Error) throw r;
      return r ?? { kind: 'ingested', email_id: 'e', attachments: 0, has_parent: false, has_body: true };
    },
    now: () => NOW,
    log,
  };
  return { deps, ingested, logged };
}

const obj = (key: string, lastModified: string): R2ObjectInfo => ({ key, size: 1228, lastModified });

describe('envelopeFromMetadata', () => {
  it('rebuilds the envelope the webhook would have received, with r2_key = object key', () => {
    const built = envelopeFromMetadata(obj('inbound/1-a.eml', minutesAgo(30)), fullMeta);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope).toMatchObject({
      from_email: 'registratura@primaria.ro',
      to_email: 'ion.popescu@implicarecivica.ro',
      subject: 'Re: Cerere',
      message_id: 'm1@primaria.ro',
      r2_key: 'inbound/1-a.eml',
      raw_size: 1228,
      received_at: '2026-09-08T09:00:00.000Z',
    });
    expect(built.envelope.in_reply_to).toBeUndefined();
  });

  it('falls back to the object size and lastModified when raw_size/received_at are missing', () => {
    const built = envelopeFromMetadata(obj('inbound/1-a.eml', '2026-09-08T08:00:00.000Z'), { from: fullMeta.from, to: fullMeta.to });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.raw_size).toBe(1228);
    expect(built.envelope.received_at).toBe('2026-09-08T08:00:00.000Z');
    expect(built.envelope.subject).toBe('(fără subiect)');
  });

  it('reports missing required metadata (from/to)', () => {
    const built = envelopeFromMetadata(obj('inbound/1-a.eml', minutesAgo(30)), { subject: 'x' });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.reason).toMatch(/from/);
    expect(built.reason).toMatch(/to/);
  });
});

describe('reconcileInbound', () => {
  it('ingests objects older than 10 minutes, leaves in-flight ones alone, oldest first', async () => {
    const { deps, ingested } = harness([obj('inbound/new.eml', minutesAgo(3)), obj('inbound/b.eml', minutesAgo(60)), obj('inbound/a.eml', minutesAgo(120))], {}, {});
    const summary = await reconcileInbound(deps);
    expect(ingested).toEqual(['inbound/a.eml', 'inbound/b.eml']);
    expect(summary).toMatchObject({ scanned: 3, ingested: 2, duplicates: 0, skipped: 0, stale: 0, errors: 0 });
    expect(summary.details.find((d) => d.key === 'inbound/new.eml')?.outcome).toBe('in_flight');
  });

  it('counts duplicates, no_user as skipped, campaign results as ingested', async () => {
    const { deps } = harness(
      [obj('inbound/dup.eml', minutesAgo(30)), obj('inbound/nouser.eml', minutesAgo(30)), obj('inbound/camp.eml', minutesAgo(30))],
      {},
      {
        'inbound/dup.eml': { kind: 'duplicate', message_id: 'm' },
        'inbound/nouser.eml': { kind: 'no_user', to_email: 'typo@implicarecivica.ro' },
        'inbound/camp.eml': { kind: 'campaign_counted', campaign_id: 'c1' },
      },
    );
    const summary = await reconcileInbound(deps);
    expect(summary).toMatchObject({ scanned: 3, ingested: 1, duplicates: 1, skipped: 1, errors: 0 });
    expect(summary.details.find((d) => d.key === 'inbound/nouser.eml')).toEqual({
      key: 'inbound/nouser.eml',
      outcome: 'skipped',
      reason: 'no user for typo@implicarecivica.ro',
    });
  });

  it('objects older than 7 days are stale: counted, not headed, not ingested', async () => {
    const { deps, ingested } = harness([obj('inbound/old.eml', daysAgo(8))], { 'inbound/old.eml': new Error('should not HEAD') }, {});
    const summary = await reconcileInbound(deps);
    expect(summary).toMatchObject({ scanned: 1, stale: 1, ingested: 0, errors: 0 });
    expect(ingested).toEqual([]);
    expect(summary.details[0]).toMatchObject({ outcome: 'stale', reason: 'older than 7 days' });
  });

  it('insufficient metadata → skipped with the validation reason; object untouched', async () => {
    const { deps, ingested } = harness([obj('inbound/meta.eml', minutesAgo(30))], { 'inbound/meta.eml': { subject: 'only' } }, {});
    const summary = await reconcileInbound(deps);
    expect(summary).toMatchObject({ skipped: 1, ingested: 0 });
    expect(summary.details[0].reason).toMatch(/^metadata: /);
    expect(ingested).toEqual([]);
  });

  it('errors (HEAD or ingest) are caught per object, logged as inbound.reconcile_error, loop continues', async () => {
    const { deps, logged } = harness(
      [obj('inbound/head.eml', minutesAgo(30)), obj('inbound/ing.eml', minutesAgo(31)), obj('inbound/ok.eml', minutesAgo(32))],
      { 'inbound/head.eml': new Error('R2 head failed') },
      { 'inbound/ing.eml': new Error('db down') },
    );
    const summary = await reconcileInbound(deps);
    expect(summary).toMatchObject({ scanned: 3, ingested: 1, errors: 2 });
    const events = logged.map((l) => JSON.parse(l));
    expect(events.filter((e) => e.event === 'inbound.reconcile_error')).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ event: 'inbound.reconciled', scanned: 3, ingested: 1, errors: 2 });
    expect(events.at(-1).details).toBeUndefined();
  });

  it('honours custom windows', async () => {
    const { deps } = harness([obj('inbound/a.eml', minutesAgo(3)), obj('inbound/b.eml', daysAgo(2))], {}, {});
    const summary = await reconcileInbound({ ...deps, minAgeMinutes: 1, maxAgeDays: 1 });
    expect(summary).toMatchObject({ ingested: 1, stale: 1 });
  });
});

describe('reconcileInbound — per-run cap', () => {
  it('defers objects beyond maxIngest without touching them', async () => {
    const old = new Date('2026-09-06T00:00:00Z').toISOString();
    const objects = ['a', 'b', 'c'].map((k) => ({ key: `inbound/${k}.eml`, size: 1, lastModified: old }));
    const head = vi.fn(async () => ({}));
    const ingest = vi.fn();
    const summary = await reconcileInbound({
      list: async () => objects,
      head,
      ingest,
      maxIngest: 2,
      now: () => new Date('2026-09-08T12:00:00Z'),
    });
    expect(head).toHaveBeenCalledTimes(2);
    expect(summary.details.filter((d) => d.outcome === 'deferred')).toHaveLength(1);
  });
});
