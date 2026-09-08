/**
 * Business-day arithmetic for legal deadlines (Law 544/2001 art. 7, HG 123/2002 art. 16:
 * deadlines are counted in working days from the registration date).
 *
 * Days are identified by the UTC date component of the ISO input; the time of day of
 * the input is carried over unchanged to the result.
 */
import { isBusinessDay } from './holidays';

const MS_PER_DAY = 86_400_000;

function utcMidnight(dateIso: string): number {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${dateIso}`);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isoOfDay(dayMs: number): string {
  return new Date(dayMs).toISOString();
}

/**
 * `n` business days after `dateIso`, counting from the NEXT calendar day and skipping
 * weekends and Romanian public holidays. Negative `n` walks backwards the same way.
 * Returns a full ISO timestamp with the input's time of day.
 */
export function addBusinessDays(dateIso: string, n: number): string {
  const start = new Date(dateIso);
  const timeOfDay = start.getTime() - utcMidnight(dateIso);
  let day = utcMidnight(dateIso);
  const step = n < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(n));
  while (remaining > 0) {
    day += step * MS_PER_DAY;
    if (isBusinessDay(isoOfDay(day))) remaining--;
  }
  return new Date(day + timeOfDay).toISOString();
}

/**
 * Number of business days strictly after `fromIso` up to and including `toIso`
 * (UTC dates). 0 on the same date; negative when `toIso` is earlier.
 */
export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = utcMidnight(fromIso);
  const to = utcMidnight(toIso);
  if (from === to) return 0;
  const [lo, hi] = from < to ? [from, to] : [to, from];
  let count = 0;
  for (let day = lo + MS_PER_DAY; day <= hi; day += MS_PER_DAY) {
    if (isBusinessDay(isoOfDay(day))) count++;
  }
  return from < to ? count : -count;
}
