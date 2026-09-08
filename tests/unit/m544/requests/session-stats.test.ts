/**
 * requests/utils/session-stats — session status labels/colours, progress,
 * deadline urgency and dashboard aggregates.
 */
import { describe, it, expect } from 'vitest';
import {
  getSessionStatusLabel,
  getSessionStatusColor,
  getSessionProgress,
  getSessionDaysUntilDeadline,
  getSessionDeadlineUrgency,
  computeSessionStats,
} from '@m544/requests/utils/session-stats';
import type { RequestSessionWithRequests, SessionStatus } from '@m544/shared/types/session';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const NOW = local(2026, 9, 8);

const session = (partial: Partial<RequestSessionWithRequests> = {}): RequestSessionWithRequests => ({
  id: 's1',
  user_id: 'u1',
  subject: 'S',
  institution_name: 'I',
  cached_status: 'pending',
  total_requests: 0,
  answered_requests: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  requests: [],
  ...partial,
});

describe('getSessionStatusLabel', () => {
  it('maps every session status', () => {
    expect(getSessionStatusLabel('pending')).toBe('În așteptare');
    expect(getSessionStatusLabel('in_progress')).toBe('În curs');
    expect(getSessionStatusLabel('partial_answered')).toBe('Parțial răspunsă');
    expect(getSessionStatusLabel('completed')).toBe('Finalizată');
    expect(getSessionStatusLabel('overdue')).toBe('Întârziată');
    expect(getSessionStatusLabel('x' as SessionStatus)).toBe('x');
  });
});

describe('getSessionStatusColor', () => {
  it('returns bg/text/ring tokens per status and falls back to pending', () => {
    expect(getSessionStatusColor('overdue')).toEqual({
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-400',
      ring: 'ring-rose-200 dark:ring-rose-800',
    });
    expect(getSessionStatusColor('completed').bg).toContain('emerald');
    expect(getSessionStatusColor('x' as SessionStatus)).toEqual(getSessionStatusColor('pending'));
  });
});

describe('getSessionProgress', () => {
  it('rounds the answered percentage; 0 when there are no requests', () => {
    expect(getSessionProgress({ total_requests: 0, answered_requests: 0 })).toBe(0);
    expect(getSessionProgress({ total_requests: 3, answered_requests: 1 })).toBe(33);
    expect(getSessionProgress({ total_requests: 3, answered_requests: 2 })).toBe(67);
    expect(getSessionProgress({ total_requests: 4, answered_requests: 4 })).toBe(100);
  });
});

describe('getSessionDaysUntilDeadline / getSessionDeadlineUrgency', () => {
  it('null without a nearest deadline', () => {
    expect(getSessionDaysUntilDeadline({}, NOW)).toBeNull();
    expect(getSessionDeadlineUrgency({ cached_status: 'pending' }, NOW)).toBeNull();
  });

  it('classifies critical (past), warning (<= 3 days) and normal', () => {
    const at = (d: number) => ({ nearest_deadline: local(2026, 9, d).toISOString(), cached_status: 'in_progress' as const });
    expect(getSessionDaysUntilDeadline(at(11), NOW)).toBe(3);
    expect(getSessionDeadlineUrgency(at(7), NOW)).toBe('critical');
    expect(getSessionDeadlineUrgency(at(11), NOW)).toBe('warning');
    expect(getSessionDeadlineUrgency(at(12), NOW)).toBe('normal');
  });

  it('completed sessions have no urgency', () => {
    const s = { nearest_deadline: local(2026, 9, 1).toISOString(), cached_status: 'completed' as const };
    expect(getSessionDeadlineUrgency(s, NOW)).toBeNull();
  });
});

describe('computeSessionStats', () => {
  it('aggregates counts by status, totals and overdue', () => {
    const stats = computeSessionStats([
      session({ cached_status: 'completed', total_requests: 2, answered_requests: 2 }),
      session({ cached_status: 'overdue', total_requests: 3, answered_requests: 1 }),
      session({ cached_status: 'overdue', total_requests: 1, answered_requests: 0 }),
      session({ cached_status: 'pending', total_requests: 4, answered_requests: 0 }),
    ]);
    expect(stats).toEqual({
      total_sessions: 4,
      total_requests: 10,
      by_status: { pending: 1, in_progress: 0, partial_answered: 0, completed: 1, overdue: 2 },
      total_answered: 3,
      total_overdue: 2,
    });
  });

  it('handles an empty list', () => {
    expect(computeSessionStats([]).total_sessions).toBe(0);
    expect(computeSessionStats([]).by_status.pending).toBe(0);
  });
});
