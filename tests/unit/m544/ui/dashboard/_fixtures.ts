/** Shared builders for dashboard UI tests. */
import type { Request } from '@m544/shared/types/request';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';

/** Fixed clock: 15 March 2026, noon. */
export const NOW = new Date(2026, 2, 15, 12, 0, 0);

/** ISO date `days` days away from NOW (negative = past). */
export function daysFromNow(days: number): string {
  const d = new Date(NOW.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

let seq = 0;

export function makeRequest(partial: Partial<Request> = {}): Request {
  seq += 1;
  return {
    id: partial.id ?? `req-${seq}`,
    user_id: 'user-1',
    institution_name: 'Primăria Cluj',
    subject: `Subiect ${seq}`,
    request_body: `Vă rugăm să ne comunicați bugetul pe anul ${2000 + seq}?`,
    status: 'pending',
    date_initiated: daysFromNow(-10),
    date_sent: daysFromNow(-10),
    deadline_date: daysFromNow(20),
    created_at: daysFromNow(-10),
    updated_at: daysFromNow(-10),
    ...partial,
  };
}

export function makeSession(
  partial: Partial<RequestSessionWithRequests> = {},
): RequestSessionWithRequests {
  seq += 1;
  const requests = partial.requests ?? [makeRequest()];
  return {
    id: partial.id ?? `sess-${seq}`,
    user_id: 'user-1',
    subject: 'Buget local 2025',
    institution_name: 'Primăria Cluj',
    cached_status: 'pending',
    total_requests: requests.length,
    answered_requests: requests.filter((r) => r.status === 'answered').length,
    created_at: daysFromNow(-10),
    updated_at: daysFromNow(-10),
    ...partial,
    requests,
  };
}
