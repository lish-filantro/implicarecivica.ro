/**
 * GET /api/cron/reconcile-inbound — contract: CRON_SECRET guard + summary JSON.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createReconcileInboundHandler } from '@m544/inbound/reconcile/handler';
import type { ReconcileDeps } from '@m544/inbound/reconcile/reconcile';
import { createLogger } from '@m544/shared/log';

const SECRET = 'cron-secret-xyz';
const silent = createLogger({ production: false, console: { log: () => {}, warn: () => {}, error: () => {} } });

function get(auth: string | null = `Bearer ${SECRET}`) {
  return new NextRequest('http://localhost/api/cron/reconcile-inbound', {
    headers: auth ? { authorization: auth } : {},
  });
}

function deps(overrides: Partial<ReconcileDeps> = {}): ReconcileDeps {
  return {
    list: async () => [{ key: 'inbound/1.eml', size: 10, lastModified: '2026-09-08T00:00:00.000Z' }],
    head: async () => ({ from: 'a@b.ro', to: 'ion@implicarecivica.ro' }),
    ingest: async () => ({ kind: 'ingested', email_id: 'e1', attachments: 0, has_parent: false, has_body: true }),
    now: () => new Date('2026-09-08T12:00:00.000Z'),
    log: silent,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe('GET /api/cron/reconcile-inbound', () => {
  it('401 without/with wrong secret; deps are not built', async () => {
    const getDeps = vi.fn(deps);
    const h = createReconcileInboundHandler(getDeps);
    expect((await h(get(null))).status).toBe(401);
    expect((await h(get('Bearer nope'))).status).toBe(401);
    expect(getDeps).not.toHaveBeenCalled();
  });

  it('500 misconfigured when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    const res = await createReconcileInboundHandler(deps)(get('Bearer anything'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/misconfigur/i);
  });

  it('200 with the summary counts, details and checked_at', async () => {
    const res = await createReconcileInboundHandler(deps)(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ scanned: 1, ingested: 1, duplicates: 0, skipped: 0, stale: 0, errors: 0 });
    expect(body.details).toEqual([{ key: 'inbound/1.eml', outcome: 'ingested' }]);
    expect(body.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('500 generic when listing itself fails (error boundary)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await createReconcileInboundHandler(() =>
      deps({
        list: async () => {
          throw new Error('R2 list failed: 403');
        },
      }),
    )(get());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Eroare internă');
  });
});
