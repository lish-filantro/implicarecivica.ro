/**
 * shared/utils/holidays — Romanian public holidays (Orthodox Easter via Meeus, Julian → Gregorian).
 * All checks use the UTC date component of the ISO string.
 */
import { describe, it, expect } from 'vitest';
import {
  orthodoxEaster,
  romanianPublicHolidays,
  isPublicHoliday,
  isWeekend,
  isBusinessDay,
} from '@m544/shared/utils/holidays';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe('orthodoxEaster', () => {
  it('matches the known Orthodox Easter Sundays (Gregorian)', () => {
    expect(ymd(orthodoxEaster(2024))).toBe('2024-05-05');
    expect(ymd(orthodoxEaster(2025))).toBe('2025-04-20');
    expect(ymd(orthodoxEaster(2026))).toBe('2026-04-12');
    expect(ymd(orthodoxEaster(2027))).toBe('2027-05-02');
  });

  it('returns a UTC midnight', () => {
    const d = orthodoxEaster(2026);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });
});

describe('romanianPublicHolidays', () => {
  it('lists the 2025 holidays sorted (Easter 20 Apr, Pentecost 8 Jun)', () => {
    expect(romanianPublicHolidays(2025)).toEqual([
      '2025-01-01', '2025-01-02', '2025-01-06', '2025-01-07', '2025-01-24',
      '2025-04-18', '2025-04-20', '2025-04-21',
      '2025-05-01', '2025-06-01', '2025-06-08', '2025-06-09',
      '2025-08-15', '2025-11-30', '2025-12-01', '2025-12-25', '2025-12-26',
    ]);
  });

  it('lists the 2026 holidays; Pentecost Monday (1 Jun) coincides with 1 June and is not duplicated', () => {
    const list = romanianPublicHolidays(2026);
    expect(list).toEqual([
      '2026-01-01', '2026-01-02', '2026-01-06', '2026-01-07', '2026-01-24',
      '2026-04-10', '2026-04-12', '2026-04-13',
      '2026-05-01', '2026-05-31', '2026-06-01',
      '2026-08-15', '2026-11-30', '2026-12-01', '2026-12-25', '2026-12-26',
    ]);
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('isPublicHoliday / isWeekend / isBusinessDay', () => {
  it('recognises fixed and movable holidays from a full ISO timestamp (UTC date)', () => {
    expect(isPublicHoliday('2026-12-01T09:30:00.000Z')).toBe(true);
    expect(isPublicHoliday('2026-04-10T23:59:59.000Z')).toBe(true); // Good Friday
    expect(isPublicHoliday('2026-04-14T00:00:00.000Z')).toBe(false);
    expect(isPublicHoliday('2026-04-13')).toBe(true); // Easter Monday, date-only input
  });

  it('detects weekends', () => {
    expect(isWeekend('2026-09-05T10:00:00.000Z')).toBe(true); // Saturday
    expect(isWeekend('2026-09-06T10:00:00.000Z')).toBe(true); // Sunday
    expect(isWeekend('2026-09-07T10:00:00.000Z')).toBe(false); // Monday
    expect(isWeekend('2026-09-04T23:30:00.000Z')).toBe(false); // Friday late UTC stays Friday
  });

  it('business day = not weekend and not holiday', () => {
    expect(isBusinessDay('2026-09-08T10:00:00.000Z')).toBe(true);
    expect(isBusinessDay('2026-09-06T10:00:00.000Z')).toBe(false);
    expect(isBusinessDay('2026-01-24T10:00:00.000Z')).toBe(false); // Saturday and holiday
    expect(isBusinessDay('2026-01-07T10:00:00.000Z')).toBe(false); // Wednesday, holiday
  });
});
