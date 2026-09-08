import { describe, it, expect } from 'vitest';
import {
  computeRequestStats,
  computeAlerts,
  getCriticalRequests,
  getAwaitingRegistration,
  filterSessions,
} from '@m544/ui/dashboard/stats';
import { NOW, daysFromNow, makeRequest, makeSession } from './_fixtures';

const monthStart = new Date(2026, 2, 1).toISOString();
const lastMonth = new Date(2026, 1, 20).toISOString();

const fixture = () => [
  // pending, no registration number, sent 10 days ago: pending + waiting
  makeRequest({ id: 'pending-old', status: 'pending', date_initiated: lastMonth, date_sent: daysFromNow(-10) }),
  // pending, sent yesterday: pending but not waiting yet; initiated on the 1st of this month
  makeRequest({ id: 'pending-fresh', status: 'pending', date_initiated: monthStart, date_sent: daysFromNow(-1) }),
  // pending but already has a registration number: counts as registered
  makeRequest({ id: 'pending-reg', status: 'pending', registration_number: '123', date_initiated: lastMonth }),
  // received: registered + received
  makeRequest({ id: 'received', status: 'received', registration_number: '456', date_initiated: lastMonth }),
  // extension, deadline in 2 days: critical
  makeRequest({ id: 'extension', status: 'extension', registration_number: '789', extension_date: daysFromNow(2), date_initiated: lastMonth }),
  // answered, deadline long past: still answered (never demoted to delayed)
  makeRequest({ id: 'answered', status: 'answered', registration_number: '111', deadline_date: daysFromNow(-30), date_initiated: lastMonth }),
  // received, deadline yesterday: overdue, counted as delayed
  makeRequest({ id: 'overdue', status: 'received', registration_number: '222', deadline_date: daysFromNow(-1), date_initiated: lastMonth }),
  // explicit delayed status, initiated 3 days ago (this month)
  makeRequest({ id: 'delayed', status: 'delayed', registration_number: '333', date_initiated: daysFromNow(-3) }),
  // pending, deadline today: critical; no reg number and sent 5 days ago: waiting
  makeRequest({ id: 'due-today', status: 'pending', deadline_date: daysFromNow(0), date_sent: daysFromNow(-5), date_initiated: lastMonth }),
];

describe('computeRequestStats', () => {
  it('counts every status bucket with a pinned clock', () => {
    const stats = computeRequestStats(fixture(), NOW);
    expect(stats.total).toBe(9);
    expect(stats.by_status).toEqual({
      pending: 3, // pending-old, pending-fresh, due-today
      received: 1, // received (the overdue one moved to delayed)
      extension: 1,
      answered: 1,
      delayed: 2, // overdue + delayed
    });
    expect(stats.registered).toBe(2); // pending-reg + received
    expect(stats.waiting).toBe(2); // pending-old + due-today
    expect(stats.this_month).toBe(2); // pending-fresh (1 Mar) + delayed (12 Mar)
  });

  it('returns zeros for no requests', () => {
    const stats = computeRequestStats([], NOW);
    expect(stats.total).toBe(0);
    expect(stats.waiting).toBe(0);
    expect(stats.by_status.delayed).toBe(0);
  });

  it('treats a request without any deadline as its own status', () => {
    const stats = computeRequestStats(
      [makeRequest({ status: 'received', registration_number: '1', deadline_date: undefined })],
      NOW,
    );
    expect(stats.by_status.received).toBe(1);
    expect(stats.by_status.delayed).toBe(0);
  });
});

describe('alerts', () => {
  it('lists critical requests soonest first', () => {
    const critical = getCriticalRequests(fixture(), NOW);
    expect(critical.map((r) => r.id)).toEqual(['due-today', 'extension']);
  });

  it('lists requests waiting for a registration number for 3+ days', () => {
    const awaiting = getAwaitingRegistration(fixture(), NOW);
    expect(awaiting.map((r) => r.id).sort()).toEqual(['due-today', 'pending-old']);
  });

  it('builds one alert per non-empty list', () => {
    expect(computeAlerts(fixture(), NOW)).toEqual([
      { type: 'critical', message: '2 cereri cu termen în următoarele 3 zile' },
      { type: 'warning', message: '2 cereri trimise fără număr de înregistrare' },
    ]);
  });

  it('returns no alerts when nothing is urgent', () => {
    const calm = [makeRequest({ status: 'answered', registration_number: '1' })];
    expect(computeAlerts(calm, NOW)).toEqual([]);
  });
});

describe('filterSessions', () => {
  const older = makeSession({ id: 'older', cached_status: 'pending', created_at: daysFromNow(-5) });
  const newer = makeSession({ id: 'newer', cached_status: 'completed', created_at: daysFromNow(-1) });
  const sessions = [older, newer];

  it('sorts newest first without mutating the input', () => {
    expect(filterSessions(sessions, 'all').map((s) => s.id)).toEqual(['newer', 'older']);
    expect(sessions.map((s) => s.id)).toEqual(['older', 'newer']);
  });

  it('keeps only the requested status', () => {
    expect(filterSessions(sessions, 'completed').map((s) => s.id)).toEqual(['newer']);
    expect(filterSessions(sessions, 'overdue')).toEqual([]);
  });
});
