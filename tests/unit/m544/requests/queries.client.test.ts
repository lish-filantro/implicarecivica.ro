import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { listOpenRequests } from '@m544/requests/queries.client';
import { fakeSupabase, byTable } from '../emails/_fake-client';

const alice = { id: 'u1' } as User;
const asClient = (sb: ReturnType<typeof fakeSupabase>) => sb as unknown as SupabaseClient;

describe('requests queries.client', () => {
  it('listOpenRequests selects the compact columns, excludes answered, newest first', async () => {
    const rows = [{ id: 'r1', subject: 'S', institution_name: 'P', status: 'pending', registration_number: null }];
    const sb = fakeSupabase(alice, byTable({ requests: { data: rows, error: null } }));
    expect(await listOpenRequests(asClient(sb))).toEqual(rows);
    const q = sb.queries[0];
    expect(q.table).toBe('requests');
    expect(q.modifiers).toContain('select:id, subject, institution_name, status, registration_number');
    expect(q.modifiers).toContain('order:date_initiated:{"ascending":false}');
    expect(q.filters).toEqual([{ op: 'neq', args: ['status', 'answered'] }]);
  });

  it('returns [] for null data and throws on error', async () => {
    expect(await listOpenRequests(asClient(fakeSupabase(alice)))).toEqual([]);
    const bad = fakeSupabase(alice, () => ({ data: null, error: { message: 'x' } }));
    await expect(listOpenRequests(asClient(bad))).rejects.toEqual({ message: 'x' });
  });
});
