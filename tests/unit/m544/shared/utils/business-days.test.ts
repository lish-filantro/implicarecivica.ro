/**
 * shared/utils/business-days — addBusinessDays / businessDaysBetween over Romanian
 * weekends and public holidays. Counting starts on the day AFTER the input.
 */
import { describe, it, expect } from 'vitest';
import { addBusinessDays, businessDaysBetween } from '@m544/shared/utils/business-days';

describe('addBusinessDays', () => {
  it('starts counting from the next day and skips a weekend', () => {
    expect(addBusinessDays('2026-09-11T10:00:00.000Z', 1)).toBe('2026-09-14T10:00:00.000Z'); // Fri → Mon
    expect(addBusinessDays('2026-09-08T10:00:00.000Z', 10)).toBe('2026-09-22T10:00:00.000Z'); // Tue + 10 bd
  });

  it('skips Good Friday and Easter Monday 2026', () => {
    // Thu 9 Apr → Fri 10 (Good Friday), Sat, Sun (Easter), Mon 13 (Easter Monday) → Tue 14
    expect(addBusinessDays('2026-04-09T08:00:00.000Z', 1)).toBe('2026-04-14T08:00:00.000Z');
    expect(addBusinessDays('2026-04-09T08:00:00.000Z', 2)).toBe('2026-04-15T08:00:00.000Z');
  });

  it('spans Christmas 2025 and the January 2026 holidays', () => {
    // Tue 23 Dec: 24 (1), 25-26 holidays, 27-28 weekend, 29 (2), 30 (3), 31 (4), 1-2 Jan holidays, 3-4 weekend, 5 Jan (5)
    expect(addBusinessDays('2025-12-23T12:00:00.000Z', 5)).toBe('2026-01-05T12:00:00.000Z');
    // 6-7 Jan holidays → 8 Jan
    expect(addBusinessDays('2025-12-23T12:00:00.000Z', 6)).toBe('2026-01-08T12:00:00.000Z');
  });

  it('preserves the time of day (UTC) and returns a full ISO timestamp', () => {
    expect(addBusinessDays('2026-09-08T14:35:20.123Z', 1)).toBe('2026-09-09T14:35:20.123Z');
    expect(addBusinessDays('2026-09-08T23:59:59.000Z', 1)).toBe('2026-09-09T23:59:59.000Z');
    expect(addBusinessDays('2026-09-08', 1)).toBe('2026-09-09T00:00:00.000Z');
  });

  it('n = 0 returns the same instant; negative n walks backwards over non-business days', () => {
    expect(addBusinessDays('2026-09-08T10:00:00.000Z', 0)).toBe('2026-09-08T10:00:00.000Z');
    expect(addBusinessDays('2026-09-14T10:00:00.000Z', -1)).toBe('2026-09-11T10:00:00.000Z'); // Mon → Fri
    expect(addBusinessDays('2026-04-14T10:00:00.000Z', -1)).toBe('2026-04-09T10:00:00.000Z'); // over Easter
  });

  it('a standard 10-business-day deadline lands 14 calendar days out on a plain week (never 10)', () => {
    const start = '2026-09-08T10:00:00.000Z';
    const days = (new Date(addBusinessDays(start, 10)).getTime() - new Date(start).getTime()) / 86_400_000;
    expect(days).toBe(14);
  });
});

describe('businessDaysBetween', () => {
  it('counts business days strictly after `from` up to and including `to`', () => {
    expect(businessDaysBetween('2026-09-08T10:00:00.000Z', '2026-09-22T10:00:00.000Z')).toBe(10);
    expect(businessDaysBetween('2026-09-11T10:00:00.000Z', '2026-09-14T10:00:00.000Z')).toBe(1); // Fri → Mon
    expect(businessDaysBetween('2026-09-11T10:00:00.000Z', '2026-09-13T10:00:00.000Z')).toBe(0); // Fri → Sun
    expect(businessDaysBetween('2025-12-23T12:00:00.000Z', '2026-01-08T12:00:00.000Z')).toBe(6);
    expect(businessDaysBetween('2026-04-09T08:00:00.000Z', '2026-04-14T08:00:00.000Z')).toBe(1);
  });

  it('is 0 on the same UTC date regardless of time, and negative when `to` is earlier', () => {
    expect(businessDaysBetween('2026-09-08T01:00:00.000Z', '2026-09-08T23:00:00.000Z')).toBe(0);
    expect(businessDaysBetween('2026-09-22T10:00:00.000Z', '2026-09-08T10:00:00.000Z')).toBe(-10);
    expect(businessDaysBetween('2026-09-14T10:00:00.000Z', '2026-09-11T10:00:00.000Z')).toBe(-1);
  });

  it('is the inverse of addBusinessDays', () => {
    const start = '2026-03-27T09:00:00.000Z';
    for (const n of [1, 5, 10, 30]) {
      expect(businessDaysBetween(start, addBusinessDays(start, n))).toBe(n);
    }
  });
});
