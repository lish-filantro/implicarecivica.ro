/**
 * Deadline arithmetic for requests as shown on screen: CALENDAR days counted between
 * local midnights (legacy behaviour). The legal deadlines themselves are set in
 * business days by pipeline/status/deadlines; `getBusinessDaysUntilDeadline` reads
 * the remaining time in those units. The `…At(request, now)` variants take an
 * explicit clock for tests; the one-argument versions keep the legacy signatures so
 * they can still be passed straight to `Array.prototype.filter`.
 */
import type { Request } from '@m544/shared/types/request';
import { businessDaysBetween } from '@m544/shared/utils/business-days';

const DAY_MS = 24 * 60 * 60 * 1000;

function atMidnight(d: Date): number {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** extension_date when present, else deadline_date, else null. */
export function getEffectiveDeadline(request: Request): string | null {
  return request.extension_date || request.deadline_date || null;
}

/** Whole days until `deadline` (negative when past); null without a deadline. */
export function getDaysUntilDeadline(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  return Math.ceil((atMidnight(new Date(deadline)) - atMidnight(now)) / DAY_MS);
}

/**
 * Business days (weekends and Romanian public holidays excluded) strictly after `now`'s
 * UTC date up to and including the deadline's UTC date; negative when past; null without
 * a deadline.
 */
export function getBusinessDaysUntilDeadline(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  return businessDaysBetween(now.toISOString(), deadline);
}

/** Not answered and the effective deadline is within 0..3 days of `now`. */
export function isCriticalAt(request: Request, now: Date): boolean {
  if (request.status === 'answered') return false;
  const days = getDaysUntilDeadline(getEffectiveDeadline(request), now);
  return days !== null && days >= 0 && days <= 3;
}

/** Not answered and the effective deadline is before `now`'s day. */
export function isOverdueAt(request: Request, now: Date): boolean {
  if (request.status === 'answered') return false;
  const days = getDaysUntilDeadline(getEffectiveDeadline(request), now);
  return days !== null && days < 0;
}

/** Full days between date_sent and `now` (0 when never sent). */
export function daysSinceSentAt(request: Request, now: Date): number {
  if (!request.date_sent) return 0;
  return Math.floor((atMidnight(now) - atMidnight(new Date(request.date_sent))) / DAY_MS);
}

export function isCriticalRequest(request: Request): boolean {
  return isCriticalAt(request, new Date());
}

export function isOverdueRequest(request: Request): boolean {
  return isOverdueAt(request, new Date());
}

/** Days since the request was sent — pending-registration tracking. */
export function getDaysSinceSent(request: Request): number {
  return daysSinceSentAt(request, new Date());
}
