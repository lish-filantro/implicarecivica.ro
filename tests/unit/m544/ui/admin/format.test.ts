/**
 * ui/admin/format — relative time for the "Ultimul email primit" card.
 */
import { describe, it, expect } from 'vitest';
import { formatLastInbound } from '@m544/ui/admin/format';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('formatLastInbound', () => {
  it('handles null and garbage', () => {
    expect(formatLastInbound(null, NOW)).toBe('niciodată');
    expect(formatLastInbound(undefined, NOW)).toBe('niciodată');
    expect(formatLastInbound('not-a-date', NOW)).toBe('not-a-date');
  });

  it('formats minutes, hours and days in Romanian', () => {
    expect(formatLastInbound(ago(10_000), NOW)).toBe('acum');
    expect(formatLastInbound(ago(5 * 60_000), NOW)).toBe('acum 5 min');
    expect(formatLastInbound(ago(60 * 60_000), NOW)).toBe('acum 1 oră');
    expect(formatLastInbound(ago(3 * 3_600_000), NOW)).toBe('acum 3 ore');
    expect(formatLastInbound(ago(24 * 3_600_000), NOW)).toBe('acum 1 zi');
    expect(formatLastInbound(ago(49 * 3_600_000), NOW)).toBe('acum 2 zile');
  });

  it('never goes negative for timestamps slightly in the future (clock skew)', () => {
    expect(formatLastInbound(new Date(NOW.getTime() + 30_000).toISOString(), NOW)).toBe('acum');
  });
});
