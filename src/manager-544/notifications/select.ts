/**
 * Which of a user's requests deserve a line in today's deadline digest.
 * Pure: takes the requests, the user's notification window and the clock.
 *
 *  - answered requests and requests without an effective deadline: never
 *  - overdue: effective deadline before today, or status already 'delayed'
 *  - upcoming: 0 ≤ days left ≤ profile.notification_deadline_days
 *
 * Sorted overdue first, then by days left ascending (most urgent on top).
 */
import type { Request } from '@m544/shared/types/request';
import { getEffectiveDeadline, getDaysUntilDeadline } from '@m544/requests/utils/deadlines';

export type NoticeKind = 'upcoming' | 'overdue';

export interface DeadlineNotice {
  request: Request;
  kind: NoticeKind;
  /** Whole days until the effective deadline; negative when past. */
  daysLeft: number;
}

export interface NotificationWindow {
  notification_deadline_days: number;
}

function classify(request: Request, window: NotificationWindow, now: Date): DeadlineNotice | null {
  if (request.status === 'answered') return null;
  const daysLeft = getDaysUntilDeadline(getEffectiveDeadline(request), now);
  if (daysLeft === null) return null;
  if (daysLeft < 0 || request.status === 'delayed') return { request, kind: 'overdue', daysLeft };
  if (daysLeft <= window.notification_deadline_days) return { request, kind: 'upcoming', daysLeft };
  return null;
}

export function selectNotifications(requests: Request[], window: NotificationWindow, now: Date): DeadlineNotice[] {
  const notices: DeadlineNotice[] = [];
  for (const request of requests) {
    const notice = classify(request, window, now);
    if (notice) notices.push(notice);
  }
  return notices.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'overdue' ? -1 : 1;
    return a.daysLeft - b.daysLeft;
  });
}
