/**
 * Browser-side query helpers (emails + profile), moved 1:1 from
 * lib/supabase/{email,profile}-queries.ts. The Supabase client is injectable
 * (default: browser client) so the query shapes can be asserted here.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  listEmails,
  getEmailById,
  markEmailAsRead,
  deleteEmail,
  listEmailsByRequestId,
  getUnreadCount,
} from '@m544/emails/queries.client';
import { getProfile, updateProfile } from '@m544/emails/profile-queries.client';
import { fakeSupabase, byTable, type RecordedQuery } from './_fake-client';

const alice = { id: 'u1' } as User;
const asClient = (sb: ReturnType<typeof fakeSupabase>) => sb as unknown as SupabaseClient;

describe('emails queries.client', () => {
  it('listEmails orders by created_at desc and filters by type when given', async () => {
    const sb = fakeSupabase(alice, byTable({ emails: { data: [{ id: 'e1' }], error: null } }));
    expect(await listEmails(undefined, asClient(sb))).toEqual([{ id: 'e1' }]);
    expect(sb.queries[0].modifiers).toContain('order:created_at:{"ascending":false}');
    expect(sb.queries[0].filters).toEqual([]);
    await listEmails('received', asClient(sb));
    expect(sb.queries[1].filters).toEqual([{ op: 'eq', args: ['type', 'received'] }]);
  });

  it('listEmails returns [] for null data and throws on error', async () => {
    expect(await listEmails(undefined, asClient(fakeSupabase(alice)))).toEqual([]);
    const bad = fakeSupabase(alice, () => ({ data: null, error: { message: 'x' } }));
    await expect(listEmails(undefined, asClient(bad))).rejects.toEqual({ message: 'x' });
  });

  it('getEmailById returns null on PGRST116 (not found) and rethrows other errors', async () => {
    const nf = fakeSupabase(alice, () => ({ data: null, error: { message: 'nf', code: 'PGRST116' } }));
    expect(await getEmailById('e1', asClient(nf))).toBeNull();
    expect(nf.queries[0].filters).toEqual([{ op: 'eq', args: ['id', 'e1'] }]);
    expect(nf.queries[0].modifiers).toContain('single');
    const bad = fakeSupabase(alice, () => ({ data: null, error: { message: 'x', code: 'OTHER' } }));
    await expect(getEmailById('e1', asClient(bad))).rejects.toMatchObject({ code: 'OTHER' });
  });

  it('markEmailAsRead / deleteEmail target the row by id', async () => {
    const sb = fakeSupabase(alice);
    await markEmailAsRead('e1', asClient(sb));
    expect(sb.queries[0]).toMatchObject({
      table: 'emails',
      op: 'update',
      payload: { is_read: true },
      filters: [{ op: 'eq', args: ['id', 'e1'] }],
    });
    await deleteEmail('e2', asClient(sb));
    expect(sb.queries[1]).toMatchObject({ table: 'emails', op: 'delete', filters: [{ op: 'eq', args: ['id', 'e2'] }] });
  });

  it('listEmailsByRequestId orders ascending', async () => {
    const sb = fakeSupabase(alice, byTable({ emails: { data: [{ id: 'a' }, { id: 'b' }], error: null } }));
    expect(await listEmailsByRequestId('r1', asClient(sb))).toHaveLength(2);
    expect(sb.queries[0].filters).toEqual([{ op: 'eq', args: ['request_id', 'r1'] }]);
    expect(sb.queries[0].modifiers).toContain('order:created_at:{"ascending":true}');
  });

  it('getUnreadCount counts unread received emails (head request)', async () => {
    const sb = fakeSupabase(alice, () => ({ count: 4, error: null }));
    expect(await getUnreadCount(asClient(sb))).toBe(4);
    const q: RecordedQuery = sb.queries[0];
    expect(q.count).toBe('exact');
    expect(q.modifiers).toContain('head');
    expect(q.filters).toEqual([
      { op: 'eq', args: ['type', 'received'] },
      { op: 'eq', args: ['is_read', false] },
    ]);
    expect(await getUnreadCount(asClient(fakeSupabase(alice, () => ({ count: null, error: null }))))).toBe(0);
  });
});

describe('profile queries.client', () => {
  it('getProfile returns null when logged out, the row when logged in, null on PGRST116', async () => {
    expect(await getProfile(asClient(fakeSupabase(null)))).toBeNull();
    const sb = fakeSupabase(alice, byTable({ profiles: { data: { id: 'u1', display_name: 'A' }, error: null } }));
    expect(await getProfile(asClient(sb))).toMatchObject({ id: 'u1' });
    expect(sb.queries[0].filters).toEqual([{ op: 'eq', args: ['id', 'u1'] }]);
    const nf = fakeSupabase(alice, () => ({ data: null, error: { message: 'nf', code: 'PGRST116' } }));
    expect(await getProfile(asClient(nf))).toBeNull();
  });

  it("updateProfile requires a session and updates the caller's row", async () => {
    await expect(updateProfile({ theme: 'dark' }, asClient(fakeSupabase(null)))).rejects.toThrow('Not authenticated');
    const sb = fakeSupabase(alice, byTable({ profiles: { data: { id: 'u1', theme: 'dark' }, error: null } }));
    expect(await updateProfile({ theme: 'dark' }, asClient(sb))).toMatchObject({ theme: 'dark' });
    expect(sb.queries[0]).toMatchObject({
      op: 'update',
      payload: { theme: 'dark' },
      filters: [{ op: 'eq', args: ['id', 'u1'] }],
    });
  });
});
