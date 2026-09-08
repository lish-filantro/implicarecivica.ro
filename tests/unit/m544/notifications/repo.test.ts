/** Unit tests for src/manager-544/notifications/repo.ts (query shapes on a fake client). */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseNotificationsRepo } from '@m544/notifications/repo';
import { fakeSupabase, type RecordedQuery, type QueryResult } from './_fakes';

function repo(respond: (q: RecordedQuery) => QueryResult, emails: Record<string, string | undefined> = {}) {
  const sb = fakeSupabase(respond, emails);
  return { sb, repo: new SupabaseNotificationsRepo(sb as unknown as SupabaseClient) };
}

describe('SupabaseNotificationsRepo', () => {
  it('listOptedInUsers: opted-in profiles joined with the auth email; users without email are skipped', async () => {
    const { sb, repo: r } = repo(
      () => ({
        data: [
          { id: 'u1', display_name: 'Ana', notification_deadline_days: 5 },
          { id: 'u2', display_name: null, notification_deadline_days: 3 },
          { id: 'u3', display_name: 'Ghost', notification_deadline_days: 3 },
        ],
        error: null,
      }),
      { u1: 'ana@x.ro', u2: 'b@x.ro' },
    );
    const users = await r.listOptedInUsers();
    expect(users).toEqual([
      { userId: 'u1', email: 'ana@x.ro', displayName: 'Ana', deadlineDays: 5 },
      { userId: 'u2', email: 'b@x.ro', displayName: null, deadlineDays: 3 },
    ]);
    expect(sb.queries[0].table).toBe('profiles');
    expect(sb.queries[0].filters).toContainEqual({ op: 'eq', args: ['notification_email', true] });
  });

  it('listOpenRequests: user scoped, status != answered', async () => {
    const { sb, repo: r } = repo(() => ({ data: [{ id: 'r1' }], error: null }));
    const rows = await r.listOpenRequests('u1');
    expect(rows).toEqual([{ id: 'r1' }]);
    expect(sb.queries[0].table).toBe('requests');
    expect(sb.queries[0].filters).toContainEqual({ op: 'eq', args: ['user_id', 'u1'] });
    expect(sb.queries[0].filters).toContainEqual({ op: 'neq', args: ['status', 'answered'] });
  });

  it('listSentToday: filters by user and sent_on, maps to camelCase', async () => {
    const { sb, repo: r } = repo(() => ({ data: [{ request_id: 'r1', kind: 'overdue' }], error: null }));
    const rows = await r.listSentToday('u1', '2026-09-08');
    expect(rows).toEqual([{ requestId: 'r1', kind: 'overdue' }]);
    expect(sb.queries[0].table).toBe('deadline_notifications');
    expect(sb.queries[0].filters).toContainEqual({ op: 'eq', args: ['user_id', 'u1'] });
    expect(sb.queries[0].filters).toContainEqual({ op: 'eq', args: ['sent_on', '2026-09-08'] });
  });

  it('markSent: upserts one row per entry ignoring duplicates; no query for an empty list', async () => {
    const { sb, repo: r } = repo(() => ({ data: null, error: null }));
    await r.markSent('u1', [], '2026-09-08');
    expect(sb.queries).toHaveLength(0);
    await r.markSent(
      'u1',
      [
        { requestId: 'r1', kind: 'upcoming' },
        { requestId: 'r2', kind: 'overdue' },
      ],
      '2026-09-08',
    );
    const q = sb.queries[0];
    expect(q.table).toBe('deadline_notifications');
    expect(q.op).toBe('upsert');
    expect(q.payload).toEqual([
      { user_id: 'u1', request_id: 'r1', kind: 'upcoming', sent_on: '2026-09-08' },
      { user_id: 'u1', request_id: 'r2', kind: 'overdue', sent_on: '2026-09-08' },
    ]);
    expect(q.options).toMatchObject({ ignoreDuplicates: true });
  });

  it('propagates database errors', async () => {
    const { repo: r } = repo(() => ({ data: null, error: { message: 'db down' } }));
    await expect(r.listOpenRequests('u1')).rejects.toMatchObject({ message: 'db down' });
    await expect(r.listSentToday('u1', '2026-09-08')).rejects.toMatchObject({ message: 'db down' });
    await expect(r.markSent('u1', [{ requestId: 'r1', kind: 'upcoming' }], '2026-09-08')).rejects.toMatchObject({
      message: 'db down',
    });
    await expect(r.listOptedInUsers()).rejects.toMatchObject({ message: 'db down' });
  });
});
