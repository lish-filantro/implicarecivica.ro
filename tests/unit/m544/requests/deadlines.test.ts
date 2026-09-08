/**
 * requests/utils/deadlines — deadline arithmetic. The `…At` variants take an
 * explicit clock; the legacy one-argument functions delegate to them with the
 * real clock and must stay usable as `filter` callbacks.
 * Dates are built with the local-time constructor so the tests are TZ-independent.
 */
import { describe, it, expect } from 'vitest';
import {
  getEffectiveDeadline,
  getDaysUntilDeadline,
  getBusinessDaysUntilDeadline,
  isCriticalAt,
  isOverdueAt,
  daysSinceSentAt,
  isCriticalRequest,
  isOverdueRequest,
  getDaysSinceSent,
} from '@m544/requests/utils/deadlines';
import type { Request } from '@m544/shared/types/request';

const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);
const iso = (y: number, m: number, d: number, h = 0) => local(y, m, d, h).toISOString();
const NOW = local(2026, 9, 8, 10); // 2026-09-08 10:00 local
const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const req = (partial: Partial<Request> = {}): Request => ({
  id: 'r1',
  user_id: 'u1',
  institution_name: 'Primăria Pitești',
  subject: 'S',
  status: 'received',
  date_initiated: iso(2026, 9, 1),
  created_at: iso(2026, 9, 1),
  updated_at: iso(2026, 9, 1),
  ...partial,
});

describe('getEffectiveDeadline', () => {
  it('prefers extension_date, then deadline_date, else null', () => {
    expect(getEffectiveDeadline(req({ deadline_date: 'A', extension_date: 'B' }))).toBe('B');
    expect(getEffectiveDeadline(req({ deadline_date: 'A' }))).toBe('A');
    expect(getEffectiveDeadline(req())).toBeNull();
  });
});

describe('getDaysUntilDeadline', () => {
  it('counts whole days between local midnights', () => {
    expect(getDaysUntilDeadline(iso(2026, 9, 11, 23), NOW)).toBe(3);
    expect(getDaysUntilDeadline(iso(2026, 9, 8, 1), NOW)).toBe(0);
    expect(getDaysUntilDeadline(iso(2026, 9, 7, 23), NOW)).toBe(-1);
  });

  it('returns null without a deadline', () => {
    expect(getDaysUntilDeadline(null, NOW)).toBeNull();
    expect(getDaysUntilDeadline('', NOW)).toBeNull();
  });
});

describe('getBusinessDaysUntilDeadline', () => {
  const nowUtc = new Date('2026-09-08T10:00:00.000Z'); // Tuesday

  it('counts business days (UTC dates), skipping weekends and holidays', () => {
    expect(getBusinessDaysUntilDeadline('2026-09-22T10:00:00.000Z', nowUtc)).toBe(10);
    expect(getBusinessDaysUntilDeadline('2026-09-14T01:00:00.000Z', nowUtc)).toBe(4); // Wed..Fri + Mon
    expect(getBusinessDaysUntilDeadline('2026-09-13T01:00:00.000Z', nowUtc)).toBe(3); // Sunday deadline
    expect(getBusinessDaysUntilDeadline('2026-04-14T08:00:00.000Z', new Date('2026-04-09T08:00:00.000Z'))).toBe(1);
  });

  it('is 0 on the deadline day and negative once past', () => {
    expect(getBusinessDaysUntilDeadline('2026-09-08T23:00:00.000Z', nowUtc)).toBe(0);
    expect(getBusinessDaysUntilDeadline('2026-09-04T10:00:00.000Z', nowUtc)).toBe(-2); // Fri → Mon, Tue
  });

  it('returns null without a deadline and is smaller than the calendar count over a weekend', () => {
    expect(getBusinessDaysUntilDeadline(null, nowUtc)).toBeNull();
    expect(getBusinessDaysUntilDeadline('', nowUtc)).toBeNull();
    const calendar = getDaysUntilDeadline('2026-09-22T10:00:00.000Z', nowUtc)!;
    expect(calendar).toBeGreaterThan(getBusinessDaysUntilDeadline('2026-09-22T10:00:00.000Z', nowUtc)!);
  });
});

describe('isCriticalAt', () => {
  it('is critical when the effective deadline is within 0..3 days', () => {
    expect(isCriticalAt(req({ deadline_date: iso(2026, 9, 11) }), NOW)).toBe(true);
    expect(isCriticalAt(req({ deadline_date: iso(2026, 9, 8) }), NOW)).toBe(true);
    expect(isCriticalAt(req({ deadline_date: iso(2026, 9, 12) }), NOW)).toBe(false);
    expect(isCriticalAt(req({ deadline_date: iso(2026, 9, 7) }), NOW)).toBe(false);
  });

  it('uses the extension date when present', () => {
    expect(isCriticalAt(req({ deadline_date: iso(2026, 9, 9), extension_date: iso(2026, 10, 9) }), NOW)).toBe(false);
  });

  it('never for answered requests or without deadline', () => {
    expect(isCriticalAt(req({ status: 'answered', deadline_date: iso(2026, 9, 9) }), NOW)).toBe(false);
    expect(isCriticalAt(req(), NOW)).toBe(false);
  });
});

describe('isOverdueAt', () => {
  it('is overdue strictly after the deadline day', () => {
    expect(isOverdueAt(req({ deadline_date: iso(2026, 9, 7) }), NOW)).toBe(true);
    expect(isOverdueAt(req({ deadline_date: iso(2026, 9, 8) }), NOW)).toBe(false);
  });

  it('never for answered requests or without deadline', () => {
    expect(isOverdueAt(req({ status: 'answered', deadline_date: iso(2026, 9, 1) }), NOW)).toBe(false);
    expect(isOverdueAt(req(), NOW)).toBe(false);
  });
});

describe('daysSinceSentAt', () => {
  it('counts full days since date_sent', () => {
    expect(daysSinceSentAt(req({ date_sent: iso(2026, 9, 1, 18) }), NOW)).toBe(7);
    expect(daysSinceSentAt(req({ date_sent: iso(2026, 9, 8, 1) }), NOW)).toBe(0);
  });

  it('is 0 when never sent', () => {
    expect(daysSinceSentAt(req(), NOW)).toBe(0);
  });
});

describe('legacy one-argument versions (real clock)', () => {
  it('delegate to the At variants with today', () => {
    expect(isCriticalRequest(req({ deadline_date: daysFromToday(2) }))).toBe(true);
    expect(isCriticalRequest(req({ deadline_date: daysFromToday(10) }))).toBe(false);
    expect(isOverdueRequest(req({ deadline_date: daysFromToday(-2) }))).toBe(true);
    expect(isOverdueRequest(req({ deadline_date: daysFromToday(2) }))).toBe(false);
    expect(getDaysSinceSent(req({ date_sent: daysFromToday(-5) }))).toBe(5);
    expect(getDaysSinceSent(req())).toBe(0);
  });

  it('are usable directly as filter callbacks (index arg must not break them)', () => {
    const list = [req({ deadline_date: daysFromToday(1) }), req({ deadline_date: daysFromToday(-1) }), req()];
    expect(list.filter(isCriticalRequest)).toHaveLength(1);
    expect(list.filter(isOverdueRequest)).toHaveLength(1);
    expect(list.map(getDaysSinceSent)).toEqual([0, 0, 0]);
  });
});
