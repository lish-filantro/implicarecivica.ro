/**
 * Contract tests for GET /api/public/institutii-stats (src/manager-544/public-stats/handler.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createInstitutionStatsHandler, CACHE_CONTROL, type PublicStatsDeps } from '@m544/public-stats/handler';
import type { PublicStatsRepo, StatsQuery } from '@m544/public-stats/repo';
import type { StatRow } from '@m544/public-stats/aggregate';

const NOW = new Date('2026-09-08T12:00:00.000Z');

class FakeRepo implements PublicStatsRepo {
  queries: StatsQuery[] = [];
  constructor(private readonly rows: StatRow[] | Error) {}
  async listRows(query: StatsQuery): Promise<StatRow[]> {
    this.queries.push(query);
    if (this.rows instanceof Error) throw this.rows;
    return this.rows;
  }
}

function build(rows: StatRow[] | Error) {
  const repo = new FakeRepo(rows);
  const deps: PublicStatsDeps = { repo, now: () => NOW };
  return { handler: createInstitutionStatsHandler(() => deps), repo };
}

const get = (qs: string) => new NextRequest(`http://localhost/api/public/institutii-stats${qs}`);

const answered: StatRow = {
  status: 'answered',
  date_sent: '2026-08-01',
  response_received_date: '2026-08-06',
  deadline_date: '2026-08-15',
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/public/institutii-stats', () => {
  it('400 when neither nume nor slug is given', async () => {
    const { handler, repo } = build([]);
    const res = await handler(get(''));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nume|slug/);
    expect(repo.queries).toHaveLength(0);
    expect((await handler(get('?nume=&slug=%20'))).status).toBe(400);
  });

  it('200 with aggregated stats and the public cache header', async () => {
    const { handler, repo } = build([answered, answered, answered]);
    const res = await handler(get('?nume=ANAF&slug=anaf'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CACHE_CONTROL);
    expect(CACHE_CONTROL).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
    expect(await res.json()).toEqual({
      total: 3,
      insufficient: false,
      answered: 3,
      delayed: 0,
      extension: 0,
      pending: 0,
      median_days_to_answer: 5,
      answered_within_deadline_pct: 100,
    });
    expect(repo.queries).toEqual([{ nume: 'ANAF', slug: 'anaf' }]);
  });

  it('accepts slug alone and trims the params', async () => {
    const { handler, repo } = build([]);
    await handler(get('?slug=%20anaf%20'));
    expect(repo.queries).toEqual([{ nume: undefined, slug: 'anaf' }]);
  });

  it('returns only total + insufficient below the threshold', async () => {
    const { handler } = build([answered, answered]);
    const res = await handler(get('?nume=ANAF'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 2, insufficient: true });
  });

  it('500 without leaking internals when the repo fails', async () => {
    const { handler } = build(new Error('db down'));
    const res = await handler(get('?nume=ANAF'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare internă' });
  });
});
