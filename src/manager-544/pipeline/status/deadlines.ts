/**
 * Deadline arithmetic per Law 544/2001 art. 7 and the methodological norms
 * (HG 123/2002 as amended by HG 478/2016, art. 16). All legal deadlines are counted
 * in BUSINESS days (weekends and Romanian public holidays excluded) from the
 * registration date:
 *  - standard answer deadline: 10 business days
 *  - with extension: 30 business days in total
 *  - refusal: 5 business days
 */
import { addBusinessDays } from '@m544/shared/utils/business-days';

export const STANDARD_DEADLINE_DAYS = 10;
export const EXTENDED_DEADLINE_DAYS = 30;
export const REFUSAL_DEADLINE_DAYS = 5;

/**
 * Add CALENDAR days to an ISO date string; returns a full ISO timestamp.
 * Not used for legal deadlines any more (those are business days); kept for callers
 * that need plain calendar arithmetic.
 */
export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** 10 business days after registration. */
export function standardDeadline(dateReceivedIso: string): string {
  return addBusinessDays(dateReceivedIso, STANDARD_DEADLINE_DAYS);
}

/** 30 business days after registration (institution invoked the extension). */
export function extendedDeadline(dateReceivedIso: string): string {
  return addBusinessDays(dateReceivedIso, EXTENDED_DEADLINE_DAYS);
}

/** 5 business days after registration (deadline for communicating a refusal). */
export function refusalDeadline(dateReceivedIso: string): string {
  return addBusinessDays(dateReceivedIso, REFUSAL_DEADLINE_DAYS);
}
