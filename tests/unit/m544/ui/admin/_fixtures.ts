/** Builders and a fake fetch for the admin UI tests. */
import type { FetchLike, PendingUser, StatsData } from '@m544/ui/admin/types';

export const statsFixture: StatsData = {
  users: { total: 1234, new_7d: 12, new_30d: 40, active_30d: 300, pending_approval: 2 },
  dailySignups: [
    { day: '2026-03-01', count: 0 },
    { day: '2026-03-02', count: 3 },
    { day: '2026-03-03', count: 6 },
  ],
  activity: { requests_30d: 50, sessions_30d: 20, messages_30d: 400, feedback_30d: 5, campaigns_active: 1 },
  requestStatus: { pending: 5, answered: 15 },
  feedbackStatus: {},
  topInstitutions: [
    { name: 'Primăria Cluj', total: 10, answered: 8 },
    { name: 'CJ Iași', total: 4, answered: 2 },
    { name: 'ANAF', total: 3, answered: 0 },
  ],
};

export const pendingFixture: PendingUser[] = [
  {
    id: 'u1',
    email: 'ana@example.com',
    first_name: 'Ana',
    last_name: 'Pop',
    display_name: null,
    created_at: '2026-03-10T09:30:00.000Z',
  },
  {
    id: 'u2',
    email: null,
    first_name: null,
    last_name: null,
    display_name: 'ionel',
    created_at: '2026-03-11T09:30:00.000Z',
  },
];

export interface RecordedCall {
  url: string;
  init?: RequestInit;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Fake fetch driven by a URL → response factory map. Records every call.
 * Unknown URLs resolve to 404.
 */
export function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: RecordedCall[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) return jsonResponse(404, { error: 'not found' });
    return route();
  };
  return { fetchFn, calls };
}
