/**
 * shared/rate-limit — one implementation of the daily per-institution limit
 * (10 requests per user per institution per calendar day), used by
 * sessions/create, sessions/add-requests, emails/send and rate-limit/check.
 */
import { describe, it, expect } from 'vitest';
import { DAILY_LIMIT, checkDailyLimit, startOfToday, type SentCounter } from '@m544/shared/rate-limit';

function counter(counts: Record<string, number>): SentCounter {
  return {
    countSentToday: async (_userId, institutionKey) => counts[institutionKey] ?? 0,
  };
}

describe('startOfToday', () => {
  it('returns local midnight of the given instant as ISO', () => {
    const d = new Date(2026, 8, 8, 15, 30);
    const iso = startOfToday(() => d);
    const back = new Date(iso);
    expect(back.getHours()).toBe(0);
    expect(back.getMinutes()).toBe(0);
    expect(back.getDate()).toBe(8);
  });
});

describe('checkDailyLimit', () => {
  it('reports remaining quota', async () => {
    const r = await checkDailyLimit('u1', 'reg@primaria.ro', 1, counter({ 'reg@primaria.ro': 3 }));
    expect(r).toEqual({ ok: true, sent_today: 3, remaining: 7, limit: DAILY_LIMIT });
  });

  it('allows exactly up to the limit', async () => {
    const r = await checkDailyLimit('u1', 'reg@primaria.ro', 7, counter({ 'reg@primaria.ro': 3 }));
    expect(r.ok).toBe(true);
  });

  it('refuses when the requested amount exceeds what is left', async () => {
    const r = await checkDailyLimit('u1', 'reg@primaria.ro', 8, counter({ 'reg@primaria.ro': 3 }));
    expect(r).toEqual({ ok: false, sent_today: 3, remaining: 7, limit: DAILY_LIMIT });
  });

  it('remaining never goes negative', async () => {
    const r = await checkDailyLimit('u1', 'reg@primaria.ro', 1, counter({ 'reg@primaria.ro': 12 }));
    expect(r).toEqual({ ok: false, sent_today: 12, remaining: 0, limit: DAILY_LIMIT });
  });

  it('normalizes the institution key (trim + lowercase) so case variants share one bucket', async () => {
    const seen: string[] = [];
    const c: SentCounter = { countSentToday: async (_u, key) => { seen.push(key); return 0; } };
    await checkDailyLimit('u1', '  Reg@Primaria.RO ', 1, c);
    expect(seen).toEqual(['reg@primaria.ro']);
  });

  it('falls back to the institution name when the email is missing (never unlimited)', async () => {
    const seen: string[] = [];
    const c: SentCounter = { countSentToday: async (_u, key) => { seen.push(key); return 0; } };
    await checkDailyLimit('u1', { email: null, name: 'Primăria Pitești' }, 1, c);
    expect(seen).toEqual(['name:primăria pitești']);
  });
});
