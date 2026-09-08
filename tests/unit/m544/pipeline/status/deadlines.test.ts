/**
 * pipeline/status/deadlines — calendar-day arithmetic for Law 544/2001 deadlines.
 * Mirrors the addDays cases from tests/unit/pure-functions.test.ts (same behaviour).
 */
import { describe, it, expect } from 'vitest';
import {
  addDays,
  standardDeadline,
  extendedDeadline,
  STANDARD_DEADLINE_DAYS,
  EXTENDED_DEADLINE_DAYS,
  EXTENSION_EXTRA_DAYS,
} from '@m544/pipeline/status/deadlines';

describe('addDays', () => {
  it('adds 10 days (standard deadline)', () => {
    expect(new Date(addDays('2025-01-15T10:00:00Z', 10)).getDate()).toBe(25);
  });

  it('adds 30 days (extension deadline)', () => {
    const d = new Date(addDays('2025-01-01T00:00:00Z', 30));
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
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

  it('handles Feb 28 non-leap year', () => {
    const d = new Date(addDays('2025-02-25T00:00:00Z', 10));
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(7);
  });

  it('handles Feb 29 leap year (2024)', () => {
    const d = new Date(addDays('2024-02-25T00:00:00Z', 10));
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(6);
  });

  it('handles negative days', () => {
    expect(new Date(addDays('2025-03-15T00:00:00Z', -5)).getDate()).toBe(10);
  });

  it('handles large number of days (365)', () => {
    const d = new Date(addDays('2025-01-01T00:00:00Z', 365));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe('Law 544/2001 deadline constants and helpers', () => {
  it('10 standard days, 30 extended days, 20 extra days', () => {
    expect(STANDARD_DEADLINE_DAYS).toBe(10);
    expect(EXTENDED_DEADLINE_DAYS).toBe(30);
    expect(EXTENSION_EXTRA_DAYS).toBe(20);
    expect(STANDARD_DEADLINE_DAYS + EXTENSION_EXTRA_DAYS).toBe(EXTENDED_DEADLINE_DAYS);
  });

  it('standardDeadline = date_received + 10 days', () => {
    const received = '2025-03-01T10:00:00Z';
    expect(standardDeadline(received)).toBe(addDays(received, 10));
    const d = new Date(standardDeadline(received));
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(11);
  });

  it('extendedDeadline = date_received + 30 days total', () => {
    const received = '2025-03-01T10:00:00Z';
    expect(extendedDeadline(received)).toBe(addDays(received, 30));
    const d = new Date(extendedDeadline(received));
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(31);
  });

  it('extension adds 20 calendar days on top of the standard deadline', () => {
    // Calendar days (local setDate, like the old addDays): a DST switch may shift the span by an hour.
    const received = '2025-03-01T10:00:00Z';
    const diffMs = new Date(extendedDeadline(received)).getTime() - new Date(standardDeadline(received)).getTime();
    expect(Math.round(diffMs / (1000 * 60 * 60 * 24))).toBe(20);
  });
});
