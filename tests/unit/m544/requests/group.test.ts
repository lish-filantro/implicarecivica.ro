/**
 * requests/sessions/group — pure grouping used by listSessionsWithRequests.
 */
import { describe, it, expect } from 'vitest';
import { groupRequestsBySession } from '@m544/requests/sessions/group';
import type { RequestSession } from '@m544/shared/types/session';
import type { Request } from '@m544/shared/types/request';

const session = (id: string): RequestSession => ({
  id,
  user_id: 'u1',
  subject: 'S',
  institution_name: 'I',
  cached_status: 'pending',
  total_requests: 0,
  answered_requests: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
});
const request = (id: string, session_id: string | undefined): Request => ({
  id,
  user_id: 'u1',
  session_id,
  institution_name: 'I',
  subject: 'S',
  status: 'pending',
  date_initiated: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
});

describe('groupRequestsBySession', () => {
  it('attaches each request to its session, preserving both orders', () => {
    const sessions = [session('s2'), session('s1')];
    const requests = [request('r1', 's1'), request('r2', 's2'), request('r3', 's1')];
    const out = groupRequestsBySession(sessions, requests);
    expect(out.map((s) => s.id)).toEqual(['s2', 's1']);
    expect(out[0].requests.map((r) => r.id)).toEqual(['r2']);
    expect(out[1].requests.map((r) => r.id)).toEqual(['r1', 'r3']);
  });

  it('gives sessions without requests an empty list', () => {
    const out = groupRequestsBySession([session('s1')], []);
    expect(out[0].requests).toEqual([]);
  });

  it('drops requests whose session is not in the list (or has none)', () => {
    const out = groupRequestsBySession([session('s1')], [request('r1', 'other'), request('r2', undefined)]);
    expect(out[0].requests).toEqual([]);
  });

  it('returns [] for no sessions and does not mutate inputs', () => {
    const sessions = [session('s1')];
    const out = groupRequestsBySession(sessions, [request('r1', 's1')]);
    expect(groupRequestsBySession([], [])).toEqual([]);
    expect('requests' in sessions[0]).toBe(false);
    expect(out[0]).not.toBe(sessions[0]);
  });
});
