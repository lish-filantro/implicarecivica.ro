/**
 * chat/rate-limit — 60 user messages per user per UTC day, counted on
 * `messages` (sender = 'user') joined through the caller's conversations.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CHAT_DAILY_LIMIT,
  checkChatLimit,
  startOfUtcDay,
  SupabaseChatUsageCounter,
  type ChatUsageCounter,
} from '@m544/chat/rate-limit';
import { fakeSupabase } from '../emails/_fake-client';

const NOW = new Date('2026-09-08T15:30:00.000Z');
const counter = (used: number): ChatUsageCounter => ({ countToday: async () => used });

describe('startOfUtcDay', () => {
  it('is midnight UTC of the given instant', () => {
    expect(startOfUtcDay(NOW)).toBe('2026-09-08T00:00:00.000Z');
    expect(startOfUtcDay(new Date('2026-09-08T00:00:00.000Z'))).toBe('2026-09-08T00:00:00.000Z');
    expect(startOfUtcDay(new Date('2026-09-07T23:59:59.999Z'))).toBe('2026-09-07T00:00:00.000Z');
  });
});

describe('checkChatLimit', () => {
  it('limit is 60', () => {
    expect(CHAT_DAILY_LIMIT).toBe(60);
  });

  it('ok under the limit, reporting the usage', async () => {
    expect(await checkChatLimit('u1', counter(0), NOW)).toEqual({ ok: true, used: 0 });
    expect(await checkChatLimit('u1', counter(59), NOW)).toEqual({ ok: true, used: 59 });
  });

  it('refuses at and above the limit', async () => {
    expect(await checkChatLimit('u1', counter(60), NOW)).toEqual({ ok: false, used: 60, limit: 60 });
    expect(await checkChatLimit('u1', counter(75), NOW)).toEqual({ ok: false, used: 75, limit: 60 });
  });

  it('passes userId and now to the counter', async () => {
    const seen: Array<[string, Date]> = [];
    const c: ChatUsageCounter = {
      countToday: async (u, n) => {
        seen.push([u, n]);
        return 0;
      },
    };
    await checkChatLimit('u9', c, NOW);
    expect(seen).toEqual([['u9', NOW]]);
  });
});

describe('SupabaseChatUsageCounter', () => {
  it('head-counts user messages since UTC midnight through conversations!inner(user_id)', async () => {
    const sb = fakeSupabase(null, () => ({ data: null, error: null, count: 7 }));
    const c = new SupabaseChatUsageCounter(async () => sb as unknown as SupabaseClient);
    expect(await c.countToday('u1', NOW)).toBe(7);
    const q = sb.queries[0];
    expect(q.table).toBe('messages');
    expect(q.count).toBe('exact');
    expect(q.modifiers).toContain('head');
    expect(q.modifiers.some((m) => m.startsWith('select:') && m.includes('conversations!inner(user_id)'))).toBe(true);
    expect(q.filters).toEqual([
      { op: 'eq', args: ['sender', 'user'] },
      { op: 'gte', args: ['created_at', '2026-09-08T00:00:00.000Z'] },
      { op: 'eq', args: ['conversations.user_id', 'u1'] },
    ]);
  });

  it('returns 0 for a null count and throws on errors', async () => {
    const okClient = fakeSupabase(null, () => ({ count: null, error: null }));
    const ok = new SupabaseChatUsageCounter(async () => okClient as unknown as SupabaseClient);
    expect(await ok.countToday('u1', NOW)).toBe(0);
    const badClient = fakeSupabase(null, () => ({ error: { message: 'boom' } }));
    const bad = new SupabaseChatUsageCounter(async () => badClient as unknown as SupabaseClient);
    await expect(bad.countToday('u1', NOW)).rejects.toMatchObject({ message: 'boom' });
  });
});
