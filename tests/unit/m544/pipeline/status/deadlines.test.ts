/**
 * pipeline/status/deadlines — Law 544/2001 deadlines in BUSINESS days (HG 123/2002 art. 16):
 * 10 working days to answer, 30 when extended, 5 for a refusal, all from registration.
 * `addDays` (calendar) stays exported for other callers; its cases mirror tests/unit/pure-functions.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  addDays,
  standardDeadline,
  extendedDeadline,
  refusalDeadline,
  STANDARD_DEADLINE_DAYS,
  EXTENDED_DEADLINE_DAYS,
  REFUSAL_DEADLINE_DAYS,
} from '@m544/pipeline/status/deadlines';
import { addBusinessDays, businessDaysBetween } from '@m544/shared/utils/business-days';

describe('addDays (calendar days, kept for non-legal arithmetic)', () => {
  it('adds 10 days', () => {
    expect(new Date(addDays('2025-01-15T10:00:00Z', 10)).getDate()).toBe(25);
  });

  it('handles month overflow', () => {
    const d = new Date(addDays('2025-01-25T00:00:00Z', 10));
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(4);
  });

  it('returns ISO string', () => {
    expect(addDays('2025-06-01T12:00:00Z', 5)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles 0 days', () => {
    const input = '2025-03-01T10:00:00Z';
    expect(new Date(addDays(input, 0)).getDate()).toBe(new Date(input).getDate());
  });

  it('handles year overflow (Dec -> Jan)', () => {
    const d = new Date(addDays('2025-12-25T00:00:00Z', 10));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(4);
  });

  it('handles Feb 29 leap year (2024) and negative days', () => {
    const d = new Date(addDays('2024-02-25T00:00:00Z', 10));
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(6);
    expect(new Date(addDays('2025-03-15T00:00:00Z', -5)).getDate()).toBe(10);
  });
});

describe('Law 544/2001 deadline constants', () => {
  it('10 standard, 30 extended, 5 refusal — all business days', () => {
    expect(STANDARD_DEADLINE_DAYS).toBe(10);
    expect(EXTENDED_DEADLINE_DAYS).toBe(30);
    expect(REFUSAL_DEADLINE_DAYS).toBe(5);
  });
});

describe('standardDeadline / extendedDeadline / refusalDeadline', () => {
  const received = '2026-09-08T10:00:00.000Z'; // Tuesday, no holidays ahead

  it('are computed with addBusinessDays, not calendar days', () => {
    expect(standardDeadline(received)).toBe(addBusinessDays(received, 10));
    expect(extendedDeadline(received)).toBe(addBusinessDays(received, 30));
    expect(refusalDeadline(received)).toBe(addBusinessDays(received, 5));
    expect(standardDeadline(received)).not.toBe(addDays(received, 10));
  });

  it('standard: Tue 8 Sep 2026 + 10 business days = Tue 22 Sep 2026, same time of day', () => {
    expect(standardDeadline(received)).toBe('2026-09-22T10:00:00.000Z');
    expect(businessDaysBetween(received, standardDeadline(received))).toBe(10);
  });

  it('extended: 30 business days = 6 calendar weeks on a holiday-free span', () => {
    expect(extendedDeadline(received)).toBe('2026-10-20T10:00:00.000Z');
    expect(businessDaysBetween(received, extendedDeadline(received))).toBe(30);
  });

  it('refusal: Tue 8 Sep 2026 + 5 business days = Tue 15 Sep 2026', () => {
    expect(refusalDeadline(received)).toBe('2026-09-15T10:00:00.000Z');
  });

  it('skips public holidays: registered Thu 9 Apr 2026 (Easter week-end ahead)', () => {
    // Fri 10 (Good Friday) and Mon 13 (Easter Monday) are not counted:
    // 14, 15, 16, 17, 20, 21, 22, 23, 24, 27 Apr → 10 business days end Mon 27 Apr; 5 end Mon 20 Apr.
    expect(standardDeadline('2026-04-09T08:00:00.000Z')).toBe('2026-04-27T08:00:00.000Z');
    expect(refusalDeadline('2026-04-09T08:00:00.000Z')).toBe('2026-04-20T08:00:00.000Z');
  });

  it('skips the Christmas / New Year holidays', () => {
    // Tue 23 Dec 2025: 24, 29, 30, 31 Dec, 5, 8, 9, 12, 13, 14 Jan → Wed 14 Jan 2026
    expect(standardDeadline('2025-12-23T12:00:00.000Z')).toBe('2026-01-14T12:00:00.000Z');
  });
});
