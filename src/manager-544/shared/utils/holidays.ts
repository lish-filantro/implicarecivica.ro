/**
 * Romanian public holidays (Codul muncii art. 139) and business-day predicates.
 *
 * Orthodox Easter comes from the Meeus Julian algorithm; the Julian date is shifted
 * by 13 days to the Gregorian calendar, which is exact for 1900–2099.
 *
 * Every predicate works on the UTC date component of the ISO string it receives
 * (`YYYY-MM-DD` or a full timestamp); the time of day is ignored.
 */

const MS_PER_DAY = 86_400_000;
const CACHE = new Map<number, ReadonlySet<string>>();

/** Orthodox Easter Sunday of `year`, as a UTC midnight (Gregorian calendar, 1900–2099). */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // Julian month (3 = March, 4 = April)
  const day = ((d + e + 114) % 31) + 1; // Julian day
  return new Date(Date.UTC(year, month - 1, day + 13));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plusDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function fixed(year: number, month: number, day: number): string {
  return ymd(new Date(Date.UTC(year, month - 1, day)));
}

/** Legal public holidays of `year` as sorted, de-duplicated `YYYY-MM-DD` strings. */
export function romanianPublicHolidays(year: number): string[] {
  const easter = orthodoxEaster(year);
  const days = new Set<string>([
    fixed(year, 1, 1),
    fixed(year, 1, 2),
    fixed(year, 1, 6), // Boboteaza
    fixed(year, 1, 7), // Sf. Ioan Botezătorul
    fixed(year, 1, 24), // Unirea Principatelor
    ymd(plusDays(easter, -2)), // Vinerea Mare
    ymd(easter),
    ymd(plusDays(easter, 1)),
    fixed(year, 5, 1),
    fixed(year, 6, 1),
    ymd(plusDays(easter, 49)), // Rusalii
    ymd(plusDays(easter, 50)),
    fixed(year, 8, 15), // Adormirea Maicii Domnului
    fixed(year, 11, 30), // Sf. Andrei
    fixed(year, 12, 1),
    fixed(year, 12, 25),
    fixed(year, 12, 26),
  ]);
  return [...days].sort();
}

function holidaySet(year: number): ReadonlySet<string> {
  let set = CACHE.get(year);
  if (!set) {
    set = new Set(romanianPublicHolidays(year));
    CACHE.set(year, set);
  }
  return set;
}

function utcDate(dateIso: string): Date {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${dateIso}`);
  return d;
}

export function isPublicHoliday(dateIso: string): boolean {
  const d = utcDate(dateIso);
  return holidaySet(d.getUTCFullYear()).has(ymd(d));
}

export function isWeekend(dateIso: string): boolean {
  const day = utcDate(dateIso).getUTCDay();
  return day === 0 || day === 6;
}

/** Neither weekend nor public holiday (UTC date component). */
export function isBusinessDay(dateIso: string): boolean {
  return !isWeekend(dateIso) && !isPublicHoliday(dateIso);
}
