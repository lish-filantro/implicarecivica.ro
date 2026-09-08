/**
 * Deadline arithmetic per Law 544/2001:
 *  - standard answer deadline: 10 calendar days from date_received
 *  - with extension: 10 + 20 = 30 calendar days from date_received
 */

export const STANDARD_DEADLINE_DAYS = 10;
export const EXTENSION_EXTRA_DAYS = 20;
export const EXTENDED_DEADLINE_DAYS = STANDARD_DEADLINE_DAYS + EXTENSION_EXTRA_DAYS;

/** Add calendar days to an ISO date string; returns a full ISO timestamp. */
export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function standardDeadline(dateReceivedIso: string): string {
  return addDays(dateReceivedIso, STANDARD_DEADLINE_DAYS);
}

export function extendedDeadline(dateReceivedIso: string): string {
  return addDays(dateReceivedIso, EXTENDED_DEADLINE_DAYS);
}
