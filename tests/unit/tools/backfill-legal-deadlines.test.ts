/**
 * tools/backfill-legal-deadlines — the planning step of the one-shot deadline backfill.
 *
 * Only `planBackfill` / `formatPlan` are exercised: they are pure, and the script's `main()`
 * runs only when the file is the process entry point, so importing it here opens no connection.
 */
import { describe, it, expect } from 'vitest';
import { planBackfill, formatPlan, type BackfillRow } from '../../../tools/backfill-legal-deadlines';

const row = (partial: Partial<BackfillRow> & { id: string }): BackfillRow => ({
  date_received: '2026-09-07T09:12:00.000Z',
  deadline_date: null,
  extension_date: null,
  status: 'received',
  ...partial,
});

describe('planBackfill — deciding what is already correct', () => {
  /**
   * PostgREST serialises a `TIMESTAMPTZ` with an explicit offset (`+00:00`), not with `Z`. A row
   * already carrying the correct deadline therefore comes back as a different string for the same
   * instant, and a string comparison reports every open request as needing a change — which empties
   * the "unchanged" count and dilutes the drift statistics the dry run exists to show.
   */
  it('treats a deadline stored as +00:00 as unchanged, not as a change of zero days', () => {
    const plan = planBackfill([
      row({ id: 'already-correct', deadline_date: '2026-09-18T23:59:59.999+00:00' }),
    ]);
    expect(plan.unchanged).toBe(1);
    expect(plan.changes).toHaveLength(0);
  });

  it('treats an extension stored as +00:00 as unchanged too', () => {
    const plan = planBackfill([
      row({
        id: 'extension-correct',
        status: 'extension',
        deadline_date: '2026-09-18T23:59:59.999+00:00',
        extension_date: '2026-10-08T23:59:59.999+00:00',
      }),
    ]);
    expect(plan.unchanged).toBe(1);
    expect(plan.changes).toHaveLength(0);
  });

  it('still plans a change when the stored deadline is a different instant', () => {
    const plan = planBackfill([row({ id: 'stale', deadline_date: '2026-09-22T00:00:00+00:00' })]);
    expect(plan.unchanged).toBe(0);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ newDeadline: '2026-09-18T23:59:59.999Z', driftDays: 4 });
  });
});

describe('planBackfill — scope and failures', () => {
  it('covers answered requests as well: their deadlines feed the published statistics', () => {
    const plan = planBackfill([
      row({ id: 'open', deadline_date: '2026-09-22T00:00:00.000Z' }),
      row({ id: 'answered', status: 'answered', deadline_date: '2026-09-22T00:00:00.000Z' }),
    ]);
    expect(plan.changes.map((c) => c.id)).toEqual(['open', 'answered']);
    expect(plan.changes.map((c) => c.status)).toEqual(['received', 'answered']);
  });

  it('recomputes an extension only where the institution already asked for one', () => {
    const plan = planBackfill([
      row({ id: 'no-ext', deadline_date: '2026-09-22T00:00:00.000Z' }),
      row({ id: 'with-ext', deadline_date: '2026-09-22T00:00:00.000Z', extension_date: '2026-10-20T00:00:00.000Z' }),
    ]);
    expect(plan.changes[0].newExtension).toBeNull();
    expect(plan.changes[1].newExtension).toBe('2026-10-08T23:59:59.999Z');
  });

  it('records a bad row as a failure and keeps going', () => {
    const plan = planBackfill([
      row({ id: 'no-date', date_received: null }),
      row({ id: 'bad-date', date_received: 'nu-e-o-dată' }),
      row({ id: 'fine', deadline_date: '2026-09-22T00:00:00.000Z' }),
    ]);
    expect(plan.failures.map((f) => f.id)).toEqual(['no-date', 'bad-date']);
    expect(plan.changes.map((c) => c.id)).toEqual(['fine']);
  });
});

describe('formatPlan', () => {
  /** A row that never had a deadline has no drift to report; counting it as 0 flattens the median. */
  it('leaves rows without a previous deadline out of the drift statistics', () => {
    const plan = planBackfill([
      row({ id: 'never-had-one', deadline_date: null }),
      row({ id: 'drift-4', deadline_date: '2026-09-22T00:00:00.000Z' }),
      row({ id: 'drift-2', date_received: '2026-09-17T21:30:00.000Z', deadline_date: '2026-10-01T00:00:00.000Z' }),
    ]);
    const report = formatPlan(plan, 3);
    // Real drifts are 4 and 2. Counting the deadline-less row as 0 would report a median of 2.
    expect(report).toContain('maxim: 4 zile');
    expect(report).toContain('median: 3 zile');
  });

  it('reports open and answered requests under separate headings', () => {
    const plan = planBackfill([
      row({ id: 'open-one', deadline_date: '2026-09-22T00:00:00.000Z' }),
      row({ id: 'answered-one', status: 'answered', deadline_date: '2026-09-22T00:00:00.000Z' }),
    ]);
    const report = formatPlan(plan, 2);
    expect(report).toMatch(/Cereri deschise/);
    expect(report).toMatch(/Cereri răspunse/);
    expect(report.indexOf('open-one')).toBeLessThan(report.indexOf('Cereri răspunse'));
    expect(report.indexOf('answered-one')).toBeGreaterThan(report.indexOf('Cereri răspunse'));
  });
});
