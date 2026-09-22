/**
 * requests/utils/deadlines — deadline arithmetic. The `…At` variants take an
 * explicit clock; the legacy one-argument functions delegate to them with the
 * real clock and must stay usable as `filter` callbacks.
 * A stored deadline is a calendar day encoded as the end of that day in UTC and is read on its
 * UTC date component; `now` and `date_sent` are real instants and are read on the Romanian
 * calendar day (see shared/utils/legal-days). The fixtures are built with `Date.UTC` so the
 * tests state instants explicitly and do not depend on the machine's `TZ`.
 */
import { describe, it, expect } from 'vitest';
import {
  getEffectiveDeadline,
  getDaysUntilDeadline,
  isCriticalAt,
  isOverdueAt,
  daysSinceSentAt,
  isCriticalRequest,
  isOverdueRequest,
  getDaysSinceSent,
} from '@m544/requests/utils/deadlines';
import type { Request } from '@m544/shared/types/request';

const utc = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));
const iso = (y: number, m: number, d: number, h = 0) => utc(y, m, d, h).toISOString();
const NOW = utc(2026, 9, 8, 10); // 2026-09-08 10:00 UTC
const daysFromToday = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

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
  it('counts whole days between the deadline day and the Romanian day of now', () => {
    expect(getDaysUntilDeadline(iso(2026, 9, 11, 23), NOW)).toBe(3);
    expect(getDaysUntilDeadline(iso(2026, 9, 8, 1), NOW)).toBe(0);
    expect(getDaysUntilDeadline(iso(2026, 9, 7, 23), NOW)).toBe(-1);
  });

  it('returns null without a deadline', () => {
    expect(getDaysUntilDeadline(null, NOW)).toBeNull();
    expect(getDaysUntilDeadline('', NOW)).toBeNull();
  });
});

/**
 * `now` is a real instant, so its day is the Romanian calendar day; the stored deadline is an
 * encoded day (`…T23:59:59.999Z`) and keeps its UTC date component. Mixing the two up showed a
 * user in Romania "0 days left" at 01:30 local on a deadline that had expired the day before.
 */
describe('the current instant is read on the Romanian calendar day', () => {
  // 2026-09-18T22:30Z = 19 September, 01:30 in Romania (UTC+3).
  const pastMidnightInRomania = utc(2026, 9, 18, 22, 30);
  const deadline = '2026-09-18T23:59:59.999Z';

  it('counts the deadline as yesterday once it is past midnight in Romania', () => {
    expect(getDaysUntilDeadline(deadline, pastMidnightInRomania)).toBe(-1);
    expect(isOverdueAt(req({ deadline_date: deadline }), pastMidnightInRomania)).toBe(true);
    expect(isCriticalAt(req({ deadline_date: deadline }), pastMidnightInRomania)).toBe(false);
  });

  it('is still the deadline day two hours earlier, when Romania has not rolled over yet', () => {
    const beforeMidnightInRomania = utc(2026, 9, 18, 20, 30); // 23:30 in Romania
    expect(getDaysUntilDeadline(deadline, beforeMidnightInRomania)).toBe(0);
    expect(isOverdueAt(req({ deadline_date: deadline }), beforeMidnightInRomania)).toBe(false);
  });

  it('counts days since date_sent on the Romanian day of both instants', () => {
    // date_sent 2026-09-10T21:30Z is already 11 September in Romania, so the request is 8 days
    // old at noon on 19 September — on the UTC day it would have looked a day older.
    const noonOn19 = utc(2026, 9, 19, 10);
    expect(daysSinceSentAt(req({ date_sent: '2026-09-10T21:30:00.000Z' }), noonOn19)).toBe(8);
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
