/**
 * Pure dashboard math: KPI counters, alert lists and the session filter.
 * Every function takes an explicit `now` so tests can pin the clock.
 */
import type { DashboardAlert, DashboardStats, Request } from '@m544/shared/types/request';
import type { RequestSessionWithRequests, SessionStatus } from '@m544/shared/types/session';
import {
  getEffectiveDeadline,
  getDaysUntilDeadline,
  daysSinceSentAt,
  isCriticalAt,
} from '@m544/requests/utils';

export type SessionFilter = SessionStatus | 'all';

/** Request-level counters for the KPI cards (deadline already past → counted as delayed). */
export function computeRequestStats(allRequests: Request[], now: Date = new Date()): DashboardStats {
  const stats: DashboardStats = {
    total: allRequests.length,
    this_month: 0,
    registered: 0,
    waiting: 0,
    by_status: { pending: 0, received: 0, extension: 0, answered: 0, delayed: 0 },
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  allRequests.forEach((request) => {
    let status = request.status;

    const effectiveDeadline = getEffectiveDeadline(request);
    const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline, now) : null;

    if (status !== 'answered' && daysLeft !== null && daysLeft < 0) {
      status = 'delayed';
    }

    if (status === 'delayed') {
      stats.by_status.delayed += 1;
    } else if (status === 'pending') {
      if (request.registration_number) {
        stats.registered += 1;
      } else {
        stats.by_status.pending += 1;
      }
    } else if (status === 'received') {
      stats.registered += 1;
      stats.by_status.received += 1;
    } else {
      stats.by_status[status] += 1;
    }

    if (!request.registration_number && daysSinceSentAt(request, now) >= 3) {
      stats.waiting += 1;
    }

    const initiated = request.date_initiated ? new Date(request.date_initiated) : null;
    if (initiated && initiated >= monthStart) {
      stats.this_month += 1;
    }
  });

  return stats;
}

/** Unanswered requests due within 3 days, soonest first. */
export function getCriticalRequests(allRequests: Request[], now: Date = new Date()): Request[] {
  return allRequests
    .filter((request) => isCriticalAt(request, now))
    .sort((a, b) => {
      const daysA = getDaysUntilDeadline(getEffectiveDeadline(a), now);
      const daysB = getDaysUntilDeadline(getEffectiveDeadline(b), now);
      return (daysA ?? Infinity) - (daysB ?? Infinity);
    });
}

/** Requests sent at least 3 days ago that still have no registration number. */
export function getAwaitingRegistration(allRequests: Request[], now: Date = new Date()): Request[] {
  return allRequests.filter((request) => {
    if (request.registration_number) return false;
    return daysSinceSentAt(request, now) >= 3;
  });
}

export function computeAlerts(allRequests: Request[], now: Date = new Date()): DashboardAlert[] {
  const critical = getCriticalRequests(allRequests, now);
  const awaiting = getAwaitingRegistration(allRequests, now);
  const list: DashboardAlert[] = [];
  if (critical.length) {
    list.push({
      type: 'critical',
      message: `${critical.length} cereri cu termen în următoarele 3 zile`,
    });
  }
  if (awaiting.length) {
    list.push({
      type: 'warning',
      message: `${awaiting.length} cereri trimise fără număr de înregistrare`,
    });
  }
  return list;
}

/** Sessions matching the status filter, newest first (input untouched). */
export function filterSessions(
  sessions: RequestSessionWithRequests[],
  statusFilter: SessionFilter,
): RequestSessionWithRequests[] {
  const filtered = statusFilter === 'all'
    ? sessions
    : sessions.filter((s) => s.cached_status === statusFilter);

  return [...filtered].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
