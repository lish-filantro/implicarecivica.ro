/**
 * Open-data statistics for one institution, computed from the requests sent
 * through the platform. Pure: rows in, aggregate out. Anonymisation: below
 * MIN_ROWS_FOR_STATS only the total is published.
 */
import type { Request } from '@m544/shared/types/request';
import { romanianDay } from '@m544/shared/utils/legal-days';

export type StatRow = Pick<
  Request,
  'status' | 'date_sent' | 'date_received' | 'response_received_date' | 'deadline_date' | 'extension_date'
>;

export interface InstitutionStats {
  total: number;
  insufficient: boolean;
  answered?: number;
  delayed?: number;
  extension?: number;
  pending?: number;
  /** Median calendar days between sending and the answer; null without answered rows. */
  median_days_to_answer?: number | null;
  /** Share (0–100) of answered rows that arrived by the (extended) deadline; null without answered rows. */
  answered_within_deadline_pct?: number | null;
}

export const MIN_ROWS_FOR_STATS = 3;

const DAY_MS = 86400000;

/**
 * Two kinds of date, read two different ways — the same distinction as in
 * `requests/utils/deadlines` and `shared/utils/legal-days`:
 *
 *  - A stored deadline is not an instant but a calendar day encoded as the end of that day in
 *    UTC, so it is read on the UTC date component.
 *  - `response_received_date`, `date_sent`, `date_received` and `now` are real instants, so
 *    their day is the day in the Romanian calendar. Read on the UTC day, an answer arriving at
 *    22:30Z — already 01:30 the next morning in Romania — was counted as within a deadline that
 *    had expired at midnight, and `answered_within_deadline_pct` overstated compliance. That
 *    number is published on the institution pages as "Răspunsuri în termen".
 */

/** UTC day number of a stored deadline, or null when unparsable. */
function storedDayNumber(value: string | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY_MS);
}

/** Romanian calendar day number of a real instant, or null when unparsable. */
function instantDayNumber(value: string | undefined): number | null {
  if (!value) return null;
  if (Number.isNaN(new Date(value).getTime())) return null;
  return Date.parse(`${romanianDay(value)}T00:00:00.000Z`) / DAY_MS;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isOverdue(row: StatRow, today: number): boolean {
  const deadline = storedDayNumber(row.extension_date ?? row.deadline_date);
  return deadline !== null && deadline < today;
}

export function aggregateInstitutionStats(rows: StatRow[], now: Date): InstitutionStats {
  const total = rows.length;
  if (total < MIN_ROWS_FOR_STATS) return { total, insufficient: true };

  // `now` is an instant too. NaN for an unusable clock, as before: every `deadline < today`
  // comparison is then false, so nothing is reported overdue on a broken clock.
  const today = Number.isNaN(now.getTime()) ? Number.NaN : (instantDayNumber(now.toISOString()) as number);
  let answered = 0;
  let delayed = 0;
  let extension = 0;
  const daysToAnswer: number[] = [];
  let withDeadline = 0;
  let withinDeadline = 0;

  for (const row of rows) {
    if (row.status === 'answered') {
      answered += 1;
      const sent = instantDayNumber(row.date_sent) ?? instantDayNumber(row.date_received);
      const received = instantDayNumber(row.response_received_date);
      if (sent !== null && received !== null) daysToAnswer.push(Math.max(0, received - sent));
      const deadline = storedDayNumber(row.extension_date ?? row.deadline_date);
      if (received !== null && deadline !== null) {
        withDeadline += 1;
        if (received <= deadline) withinDeadline += 1;
      }
      continue;
    }
    if (row.status === 'delayed' || isOverdue(row, today)) {
      delayed += 1;
      continue;
    }
    if (row.status === 'extension') extension += 1;
  }

  return {
    total,
    insufficient: false,
    answered,
    delayed,
    extension,
    pending: total - answered - delayed - extension,
    median_days_to_answer: median(daysToAnswer),
    answered_within_deadline_pct: withDeadline === 0 ? null : Math.round((withinDeadline / withDeadline) * 100),
  };
}
