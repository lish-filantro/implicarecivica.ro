import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { listAssignableRequests } from '@m544/requests/queries.client';
import { fakeSupabase, byTable } from '../emails/_fake-client';

const alice = { id: 'u1' } as User;
const asClient = (sb: ReturnType<typeof fakeSupabase>) => sb as unknown as SupabaseClient;

describe('requests queries.client', () => {
  it('listAssignableRequests keeps answered requests and carries the session label', async () => {
    const rows = [
      {
        id: 'r1',
        subject: 'Buget 2026',
        institution_name: 'Primăria Cluj',
        institution_email: 'registratura@primariaclujnapoca.ro',
        status: 'answered',
        registration_number: '4521',
        deadline_date: '2026-10-03',
        extension_date: null,
        session_id: 's1',
        request_sessions: { id: 's1', name: 'Cheltuieli cultură', subject: 'Buget 2026' },
      },
    ];
    const sb = fakeSupabase(alice, byTable({ requests: { data: rows, error: null } }));
    expect(await listAssignableRequests(asClient(sb))).toEqual([
      {
        id: 'r1',
        subject: 'Buget 2026',
        institution_name: 'Primăria Cluj',
        institution_email: 'registratura@primariaclujnapoca.ro',
        status: 'answered',
        registration_number: '4521',
        deadline_date: '2026-10-03',
        extension_date: null,
        session_id: 's1',
        session_label: 'Cheltuieli cultură',
      },
    ]);
    const q = sb.queries[0];
    expect(q.table).toBe('requests');
    // No status filter: a follow-up can land on an already answered question.
    expect(q.filters).toEqual([]);
  });

  it('listAssignableRequests falls back to the session subject, then to the request subject', async () => {
    const rows = [
      { id: 'r1', session_id: 's1', subject: 'Buget', request_sessions: { id: 's1', name: null, subject: 'Sesiunea A' } },
      { id: 'r2', session_id: null, subject: 'Buget', request_sessions: null },
    ];
    const sb = fakeSupabase(alice, byTable({ requests: { data: rows, error: null } }));
    const out = await listAssignableRequests(asClient(sb));
    expect(out.map((r) => r.session_label)).toEqual(['Sesiunea A', 'Buget']);
  });

  it('returns [] for null data and throws on error', async () => {
    expect(await listAssignableRequests(asClient(fakeSupabase(alice)))).toEqual([]);
    const bad = fakeSupabase(alice, () => ({ data: null, error: { message: 'x' } }));
    await expect(listAssignableRequests(asClient(bad))).rejects.toEqual({ message: 'x' });
  });
});
