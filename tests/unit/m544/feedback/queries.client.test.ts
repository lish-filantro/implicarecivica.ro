/**
 * Browser-side feedback queries, moved 1:1 from lib/supabase/feedback-queries.ts.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createFeedback, listMyFeedback } from '@m544/feedback/queries.client';
import { fakeSupabase, byTable } from '../emails/_fake-client';

const alice = { id: 'u1' } as User;
const asClient = (sb: ReturnType<typeof fakeSupabase>) => sb as unknown as SupabaseClient;

describe('feedback queries.client', () => {
  it('createFeedback requires a session', async () => {
    await expect(createFeedback({ category: 'bug', message: 'x' }, asClient(fakeSupabase(null)))).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('createFeedback inserts for the current user and returns the row', async () => {
    const sb = fakeSupabase(alice, byTable({ feedback: { data: { id: 'f1' }, error: null } }));
    expect(await createFeedback({ category: 'bug', message: 'nu merge' }, asClient(sb))).toEqual({ id: 'f1' });
    expect(sb.queries[0]).toMatchObject({
      table: 'feedback',
      op: 'insert',
      payload: { user_id: 'u1', category: 'bug', message: 'nu merge', page_url: null },
    });
    expect(sb.queries[0].modifiers).toContain('single');
  });

  it('createFeedback throws on DB error', async () => {
    const sb = fakeSupabase(alice, () => ({ data: null, error: { message: 'boom' } }));
    await expect(createFeedback({ category: 'bug', message: 'x', page_url: '/a' }, asClient(sb))).rejects.toEqual({
      message: 'boom',
    });
  });

  it('listMyFeedback orders newest first and returns [] for null', async () => {
    const sb = fakeSupabase(alice, byTable({ feedback: { data: [{ id: 'f2' }, { id: 'f1' }], error: null } }));
    expect(await listMyFeedback(asClient(sb))).toHaveLength(2);
    expect(sb.queries[0].modifiers).toContain('order:created_at:{"ascending":false}');
    expect(await listMyFeedback(asClient(fakeSupabase(alice)))).toEqual([]);
  });
});
