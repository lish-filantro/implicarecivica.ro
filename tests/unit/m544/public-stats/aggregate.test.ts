/**
 * public-stats/aggregate — anonymised per-institution statistics over request rows.
 */
import { describe, it, expect } from 'vitest';
import { aggregateInstitutionStats, MIN_ROWS_FOR_STATS, type StatRow } from '@m544/public-stats/aggregate';

const NOW = new Date('2026-09-08T12:00:00.000Z');

function answered(sent: string, received: string, deadline: string, extension?: string): StatRow {
  return {
    status: 'answered',
    date_sent: sent,
    date_received: undefined,
    response_received_date: received,
    deadline_date: deadline,
    extension_date: extension,
  };
}

describe('aggregateInstitutionStats', () => {
  it('exposes the anonymisation threshold', () => {
    expect(MIN_ROWS_FOR_STATS).toBe(3);
  });

  it('returns only { total, insufficient: true } for fewer than 3 rows', () => {
    expect(aggregateInstitutionStats([], NOW)).toEqual({ total: 0, insufficient: true });
    const rows = [answered('2026-08-01', '2026-08-05', '2026-08-15'), answered('2026-08-01', '2026-08-05', '2026-08-15')];
    expect(aggregateInstitutionStats(rows, NOW)).toEqual({ total: 2, insufficient: true });
  });

  it('counts answered / delayed / extension / pending, using now for overdue open requests', () => {
    const rows: StatRow[] = [
      answered('2026-08-01', '2026-08-05', '2026-08-15'),
      { status: 'delayed', date_sent: '2026-07-01', deadline_date: '2026-07-15' },
      { status: 'extension', date_sent: '2026-08-20', deadline_date: '2026-09-03', extension_date: '2026-10-01' },
      { status: 'pending', date_sent: '2026-09-05', deadline_date: '2026-09-19' },
      // deadline passed but the cron has not flagged it yet: counted as delayed
      { status: 'received', date_sent: '2026-08-01', date_received: '2026-08-02', deadline_date: '2026-08-16' },
    ];
    const out = aggregateInstitutionStats(rows, NOW);
    expect(out).toMatchObject({ total: 5, insufficient: false, answered: 1, delayed: 2, extension: 1, pending: 1 });
  });

  it('median of days to answer — odd count', () => {
    const rows = [
      answered('2026-08-01', '2026-08-03', '2026-08-15'), // 2
      answered('2026-08-01', '2026-08-11', '2026-08-15'), // 10
      answered('2026-08-01', '2026-08-31', '2026-08-15'), // 30
    ];
    expect(aggregateInstitutionStats(rows, NOW).median_days_to_answer).toBe(10);
  });

  it('median of days to answer — even count averages the middle two', () => {
    const rows = [
      answered('2026-08-01', '2026-08-03', '2026-08-15'), // 2
      answered('2026-08-01', '2026-08-05', '2026-08-15'), // 4
      answered('2026-08-01', '2026-08-11', '2026-08-15'), // 10
      answered('2026-08-01', '2026-08-31', '2026-08-15'), // 30
    ];
    expect(aggregateInstitutionStats(rows, NOW).median_days_to_answer).toBe(7);
  });

  it('falls back to date_received when date_sent is missing and works with ISO timestamps', () => {
    const rows: StatRow[] = [
      {
        status: 'answered',
        date_received: '2026-08-01T10:00:00.000Z',
        response_received_date: '2026-08-06T08:00:00.000Z',
        deadline_date: '2026-08-15',
      },
      answered('2026-08-01', '2026-08-06', '2026-08-15'),
      answered('2026-08-01', '2026-08-06', '2026-08-15'),
    ];
    expect(aggregateInstitutionStats(rows, NOW).median_days_to_answer).toBe(5);
  });

  it('answered_within_deadline_pct uses the extension date when present', () => {
    const rows = [
      answered('2026-08-01', '2026-08-10', '2026-08-15'), // in time
      answered('2026-08-01', '2026-08-15', '2026-08-15'), // on the day: in time
      answered('2026-08-01', '2026-08-20', '2026-08-15'), // late
      answered('2026-08-01', '2026-09-10', '2026-08-15', '2026-09-15'), // late vs deadline, in time vs extension
    ];
    expect(aggregateInstitutionStats(rows, NOW).answered_within_deadline_pct).toBe(75);
  });

  it('median and pct are null when no request was answered', () => {
    const rows: StatRow[] = [
      { status: 'pending', date_sent: '2026-09-05', deadline_date: '2026-09-19' },
      { status: 'pending', date_sent: '2026-09-05', deadline_date: '2026-09-19' },
      { status: 'pending', date_sent: '2026-09-05', deadline_date: '2026-09-19' },
    ];
    expect(aggregateInstitutionStats(rows, NOW)).toEqual({
      total: 3,
      insufficient: false,
      answered: 0,
      delayed: 0,
      extension: 0,
      pending: 3,
      median_days_to_answer: null,
      answered_within_deadline_pct: null,
    });
  });

  it('ignores answered rows without usable dates in the median / pct', () => {
    const rows: StatRow[] = [
      { status: 'answered' },
      answered('2026-08-01', '2026-08-04', '2026-08-15'),
      answered('2026-08-01', '2026-08-04', '2026-08-15'),
    ];
    const out = aggregateInstitutionStats(rows, NOW);
    expect(out.answered).toBe(3);
    expect(out.median_days_to_answer).toBe(3);
    expect(out.answered_within_deadline_pct).toBe(100);
  });
});
