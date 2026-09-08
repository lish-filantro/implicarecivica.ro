/**
 * cron/daily — the three maintenance steps run in order, each isolated; auth contract.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { runDailyMaintenance, createDailyCronHandler, type DailyCronDeps } from '@m544/cron/daily';
import type { ReconcileDeps } from '@m544/inbound/reconcile/reconcile';
import { FakeEmailsRepo, FakeRequestsRepo, FakeStorageRepo } from '../_fakes/fake-repos';

const SECRET = 'cron-secret-for-tests-123';
const USER = 'u-1';

function irrelevant() {
  return {
    category: 'irelevant' as const,
    registration_number: null,
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    redirected_to: null,
    evidence: '',
    confidence: 1,
  };
}

function makeDeps(overrides: Partial<{ reconcile: Partial<ReconcileDeps> }> = {}) {
  const emails = new FakeEmailsRepo();
  const requests = new FakeRequestsRepo();
  const reconcile: ReconcileDeps = {
    list: async () => [],
    head: async () => ({}),
    ingest: async () => ({ kind: 'duplicate' as const, message_id: 'm-1' }),
    ...overrides.reconcile,
  };
  const deps: DailyCronDeps = {
    pipeline: { emails, requests, storage: new FakeStorageRepo(), ocr: async () => ({ markdown: '', pages: 0, docSizeBytes: null }), analyze: async () => irrelevant() },
    reconcile,
    now: () => new Date('2026-09-08T02:00:00Z'),
  };
  return { deps, emails, requests };
}

describe('runDailyMaintenance', () => {
  it('reconciles, processes pending emails and marks overdue requests, in that order', async () => {
    const { deps, emails, requests } = makeDeps();
    const order: string[] = [];
    deps.reconcile.list = async () => {
      order.push('reconcile');
      return [];
    };
    emails.seed({ user_id: USER, type: 'received', processing_status: 'pending' });
    requests.seed({ user_id: USER, status: 'received', deadline_date: '2026-09-01T00:00:00Z' });

    const summary = await runDailyMaintenance(deps);

    expect(order).toEqual(['reconcile']);
    expect(summary.reconcile).toEqual({ scanned: 0, ingested: 0, duplicates: 0, skipped: 0, stale: 0, errors: 0 });
    expect(summary.processed).toEqual({ processed: 1, successful: 1, failed: 0 });
    expect(summary.delayed_count).toBe(1);
    expect([...requests.rows.values()][0].status).toBe('delayed');
    expect(summary.success).toBe(true);
    expect(summary.errors).toEqual([]);
    expect(summary.checked_at).toBe('2026-09-08T02:00:00.000Z');
  });

  it('a failing step is recorded and the next steps still run', async () => {
    const { deps, requests } = makeDeps({
      reconcile: {
        list: async () => {
          throw new Error('R2 down');
        },
      },
    });
    requests.seed({ user_id: USER, status: 'received', deadline_date: '2026-09-01T00:00:00Z' });

    const summary = await runDailyMaintenance(deps);

    expect(summary.success).toBe(false);
    expect(summary.errors).toEqual([{ step: 'reconcile', message: 'Error: R2 down' }]);
    expect(summary.reconcile).toBeNull();
    expect(summary.processed).toEqual({ processed: 0, successful: 0, failed: 0 });
    expect(summary.delayed_count).toBe(1);
  });

  it('honours batchLimit', async () => {
    const { deps, emails } = makeDeps();
    for (let i = 0; i < 3; i++) emails.seed({ user_id: USER, type: 'received', processing_status: 'pending' });
    deps.batchLimit = 2;
    const summary = await runDailyMaintenance(deps);
    expect(summary.processed?.processed).toBe(2);
  });
});

describe('createDailyCronHandler', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const get = (auth: string | null) =>
    new NextRequest('http://localhost/api/cron/daily', { headers: auth ? { authorization: auth } : {} });

  it('401 without the secret', async () => {
    const handler = createDailyCronHandler(() => makeDeps().deps);
    const res = await handler(get(null));
    expect(res.status).toBe(401);
  });

  it('200 with the run summary', async () => {
    const handler = createDailyCronHandler(() => makeDeps().deps);
    const res = await handler(get(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, delayed_count: 0, errors: [] });
  });
});
