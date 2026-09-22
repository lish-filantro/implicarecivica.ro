/**
 * Aritmetica termenelor aşa cum se citesc pe ecran: zile întregi între zilele calendaristice
 * ale termenului şi ale momentului curent. Termenele legale sunt calculate în
 * `pipeline/status/deadlines` (zile calendaristice „pe zile libere", art. 16 alin. (2)-(3)
 * din Normele metodologice) şi stocate ca sfârşit de zi UTC, `…T23:59:59.999Z`.
 *
 * Cele două feluri de dată nu se citesc la fel — aceeaşi distincţie ca în
 * `shared/utils/legal-days`:
 *
 *  - Termenul stocat NU e un instant, ci o zi calendaristică codificată ca sfârşit de zi UTC.
 *    Se citeşte pe componenta de dată UTC: `2026-09-18T23:59:59.999Z` înseamnă „18 septembrie"
 *    în orice fus orar. Cu miezul nopţii local, la UTC+3 ar fi apărut ca 19 septembrie.
 *  - `now` şi `date_sent` SUNT instanţe reale, deci ziua lor e ziua din calendarul românesc.
 *    Citite pe ziua UTC, un utilizator din România la ora locală 01:30 vedea „0 zile rămase"
 *    şi `isOverdueAt === false` pentru un termen expirat la 24:00 în ziua precedentă.
 *
 * Variantele `…At(request, now)` primesc un ceas explicit pentru teste; versiunile cu un
 * singur argument păstrează semnăturile vechi, ca să poată fi date direct lui
 * `Array.prototype.filter`.
 */
import type { Request } from '@m544/shared/types/request';
import { romanianDay } from '@m544/shared/utils/legal-days';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ziua unui termen STOCAT — zi codificată, deci componenta de dată UTC. */
function storedDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Ziua unui INSTANT real (`now`, `date_sent`) — ziua din calendarul românesc.
 *
 * O dată nevalidă întoarce `NaN`, ca vechiul calcul pe `Date.UTC(...)`: toate comparaţiile devin
 * false şi apelantul degradează tăcut. `toISOString()` ar fi aruncat `RangeError`, iar
 * `daysSinceSentAt` e apelat din `ui/dashboard/stats` în timpul randării — un `date_sent`
 * malformat ar fi dărâmat pagina, nu doar un contor.
 */
function instantDay(d: Date): number {
  if (Number.isNaN(d.getTime())) return Number.NaN;
  return Date.parse(`${romanianDay(d.toISOString())}T00:00:00.000Z`);
}

/** extension_date when present, else deadline_date, else null. */
export function getEffectiveDeadline(request: Request): string | null {
  return request.extension_date || request.deadline_date || null;
}

/** Whole days until `deadline` (negative when past); null without a deadline. */
export function getDaysUntilDeadline(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  return Math.ceil((storedDay(new Date(deadline)) - instantDay(now)) / DAY_MS);
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
  return Math.floor((instantDay(now) - instantDay(new Date(request.date_sent))) / DAY_MS);
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
