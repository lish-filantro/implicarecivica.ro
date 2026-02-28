/**
 * Session Utilities
 * Status labels, colors, and computed values for request sessions
 */

import type { SessionStatus, RequestSessionWithRequests } from '../types/session';
import { getDaysUntilDeadline } from './requestUtils';

/**
 * Get session status label in Romanian
 */
export function getSessionStatusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    pending: 'În așteptare',
    in_progress: 'În curs',
    partial_answered: 'Parțial răspunsă',
    completed: 'Finalizată',
    overdue: 'Întârziată',
  };
  return labels[status] || status;
}

/**
 * Get session status color theme (Tailwind tokens)
 */
export function getSessionStatusColor(status: SessionStatus): {
  bg: string;
  text: string;
  ring: string;
} {
  const colors: Record<SessionStatus, { bg: string; text: string; ring: string }> = {
    pending: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      ring: 'ring-blue-200 dark:ring-blue-800',
    },
    in_progress: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
    },
    partial_answered: {
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-400',
      ring: 'ring-indigo-200 dark:ring-indigo-800',
    },
    completed: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
    },
    overdue: {
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-400',
      ring: 'ring-rose-200 dark:ring-rose-800',
    },
  };
  return colors[status] || colors.pending;
}

/**
 * Get progress percentage for a session
 */
export function getSessionProgress(session: { total_requests: number; answered_requests: number }): number {
  if (session.total_requests === 0) return 0;
  return Math.round((session.answered_requests / session.total_requests) * 100);
}

/**
 * Get days until nearest deadline for a session
 */
export function getSessionDaysUntilDeadline(session: { nearest_deadline?: string }): number | null {
  return getDaysUntilDeadline(session.nearest_deadline || null);
}

/**
 * Get deadline urgency level
 */
export function getSessionDeadlineUrgency(
  session: { nearest_deadline?: string; cached_status: SessionStatus }
): 'critical' | 'warning' | 'normal' | null {
  if (session.cached_status === 'completed') return null;

  const days = getSessionDaysUntilDeadline(session);
  if (days === null) return null;
  if (days < 0) return 'critical';
  if (days <= 3) return 'warning';
  return 'normal';
}

/**
 * Compute dashboard stats from sessions
 */
export function computeSessionStats(sessions: RequestSessionWithRequests[]): {
  total_sessions: number;
  total_requests: number;
  by_status: Record<SessionStatus, number>;
  total_answered: number;
  total_overdue: number;
} {
  const byStatus: Record<SessionStatus, number> = {
    pending: 0,
    in_progress: 0,
    partial_answered: 0,
    completed: 0,
    overdue: 0,
  };

  let totalRequests = 0;
  let totalAnswered = 0;

  for (const session of sessions) {
    byStatus[session.cached_status]++;
    totalRequests += session.total_requests;
    totalAnswered += session.answered_requests;
  }

  return {
    total_sessions: sessions.length,
    total_requests: totalRequests,
    by_status: byStatus,
    total_answered: totalAnswered,
    total_overdue: byStatus.overdue,
  };
}
