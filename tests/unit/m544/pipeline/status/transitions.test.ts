/**
 * pipeline/status/transitions — pure transition table (status x category x hasRegNr x viaThread).
 */
import { describe, it, expect } from 'vitest';
import { planTransition } from '@m544/pipeline/status/transitions';
import { standardDeadline, extendedDeadline } from '@m544/pipeline/status/deadlines';
import type { EmailCategory, RequestStatus } from '@m544/shared/types/request';
import { mkAnalysis } from './_analysis';

const RECEIVED_AT = '2025-03-05T09:00:00.000Z';
const EARLIER = '2025-02-20T09:00:00.000Z';

const STATUSES: RequestStatus[] = ['pending', 'received', 'extension', 'delayed', 'answered'];
const CATEGORIES: EmailCategory[] = [
  'trimise', 'inregistrate', 'amanate', 'raspunse', 'intarziate', 'irelevant', 'redirectionat',
];

/** Expected target status when the email arrived on the thread (guard never fires). */
function expectedStatus(status: RequestStatus, category: EmailCategory): RequestStatus | null {
  if (status === 'answered') return null;
  switch (category) {
    case 'inregistrate': return 'received';
    case 'amanate': return 'extension';
    case 'raspunse':
    case 'intarziate': return 'answered';
    case 'redirectionat': return status === 'pending' ? 'received' : null;
    default: return null;
  }
}

describe('planTransition — full table (viaThread, no registration number)', () => {
  for (const status of STATUSES) {
    for (const category of CATEGORIES) {
      it(`${status} x ${category}`, () => {
        const plan = planTransition({
          current: { status, date_received: undefined, registration_number: undefined, deadline_date: undefined },
          analysis: mkAnalysis({ category }),
          emailReceivedAt: RECEIVED_AT,
          viaThread: true,
        });
        expect(plan.newStatus).toBe(expectedStatus(status, category));
        expect(plan.changes.status).toBe(expectedStatus(status, category) ?? undefined);
        if (status === 'answered') {
          expect(plan.skipped).toBe('already answered');
          expect(plan.changes).toEqual({});
        } else if (category === 'irelevant') {
          expect(plan.skipped).toBe('irrelevant email');
          expect(plan.changes).toEqual({});
        } else if (category === 'trimise') {
          expect(plan.skipped).toBeTruthy();
          expect(plan.changes).toEqual({});
        } else {
          expect(plan.skipped).toBeUndefined();
        }
        expect(plan.needsReview).toBe(false);
      });
    }
  }
});

describe('planTransition — inregistrate', () => {
  it('sets registration number, date_received and the 10-business-day deadline', () => {
    const plan = planTransition({
      current: { status: 'pending' },
      analysis: mkAnalysis({ category: 'inregistrate', registration_number: '123/2025' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.changes).toEqual({
      registration_number: '123/2025',
      date_received: RECEIVED_AT,
      deadline_date: standardDeadline(RECEIVED_AT),
      status: 'received',
    });
  });

  it('omits registration_number when the analysis has none', () => {
    const plan = planTransition({
      current: { status: 'pending' },
      analysis: mkAnalysis({ category: 'inregistrate' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.changes.registration_number).toBeUndefined();
    expect(plan.changes.status).toBe('received');
  });
});

describe('planTransition — amanate', () => {
  it('extension is 30 business days from the existing date_received, extension_days = 30, reason kept', () => {
    const plan = planTransition({
      current: { status: 'received', date_received: EARLIER },
      analysis: mkAnalysis({ category: 'amanate', extension_reason: 'volum mare' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.changes).toEqual({
      extension_date: extendedDeadline(EARLIER),
      extension_days: 30,
      status: 'extension',
      extension_reason: 'volum mare',
    });
  });

  it('falls back to the email date when the request has no date_received', () => {
    const plan = planTransition({
      current: { status: 'pending' },
      analysis: mkAnalysis({ category: 'amanate' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.changes.extension_date).toBe(extendedDeadline(RECEIVED_AT));
    expect(plan.changes.extension_reason).toBeUndefined();
  });
});

describe('planTransition — raspunse / intarziate', () => {
  for (const category of ['raspunse', 'intarziate'] as const) {
    it(`${category}: received request -> answered with summary and response date`, () => {
      const plan = planTransition({
        current: { status: 'received', date_received: EARLIER },
        analysis: mkAnalysis({ category, answer_summary: { type: 'text', content: 'ok' } }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: false,
      });
      expect(plan.changes).toEqual({
        response_received_date: RECEIVED_AT,
        status: 'answered',
        answer_summary: { type: 'text', content: 'ok' },
      });
      expect(plan.needsReview).toBe(false);
    });

    it(`${category}: pending, off-thread, no registration number -> received + needsReview`, () => {
      const plan = planTransition({
        current: { status: 'pending' },
        analysis: mkAnalysis({ category, answer_summary: 'a; b' }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: false,
      });
      expect(plan.newStatus).toBe('received');
      expect(plan.needsReview).toBe(true);
      expect(plan.changes).toEqual({
        status: 'received',
        date_received: RECEIVED_AT,
        deadline_date: standardDeadline(RECEIVED_AT),
        answer_summary: 'a; b',
      });
    });

    it(`${category}: pending, off-thread but analysis has a registration number -> answered`, () => {
      const plan = planTransition({
        current: { status: 'pending' },
        analysis: mkAnalysis({ category, registration_number: '55/2025' }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: false,
      });
      expect(plan.newStatus).toBe('answered');
      expect(plan.needsReview).toBe(false);
    });

    it(`${category}: pending, off-thread but request already registered -> answered`, () => {
      const plan = planTransition({
        current: { status: 'pending', registration_number: '55/2025' },
        analysis: mkAnalysis({ category }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: false,
      });
      expect(plan.newStatus).toBe('answered');
      expect(plan.needsReview).toBe(false);
    });

    it(`${category}: pending, on thread, no registration number -> answered`, () => {
      const plan = planTransition({
        current: { status: 'pending' },
        analysis: mkAnalysis({ category }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: true,
      });
      expect(plan.newStatus).toBe('answered');
      expect(plan.needsReview).toBe(false);
    });

    it(`${category}: answered request is never changed (terminal state)`, () => {
      const plan = planTransition({
        current: { status: 'answered', date_received: EARLIER },
        analysis: mkAnalysis({ category, answer_summary: 'new' }),
        emailReceivedAt: RECEIVED_AT,
        viaThread: true,
      });
      expect(plan.skipped).toBe('already answered');
      expect(plan.changes).toEqual({});
      expect(plan.newStatus).toBeNull();
    });
  }
});

describe('planTransition — redirectionat', () => {
  it('pending -> received with redirected_to, date_received, deadline and registration number', () => {
    const plan = planTransition({
      current: { status: 'pending' },
      analysis: mkAnalysis({ category: 'redirectionat', redirected_to: 'ANAF', registration_number: '9/2025' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.newStatus).toBe('received');
    expect(plan.needsReview).toBe(false);
    expect(plan.changes).toEqual({
      status: 'received',
      date_received: RECEIVED_AT,
      deadline_date: standardDeadline(RECEIVED_AT),
      redirected_to: 'ANAF',
      registration_number: '9/2025',
    });
  });

  it('received request keeps its status and dates; only redirected_to is added', () => {
    const plan = planTransition({
      current: {
        status: 'received',
        date_received: EARLIER,
        deadline_date: standardDeadline(EARLIER),
        registration_number: '1/2025',
      },
      analysis: mkAnalysis({ category: 'redirectionat', redirected_to: 'Consiliul Judetean', registration_number: '2/2025' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.newStatus).toBeNull();
    expect(plan.changes).toEqual({ redirected_to: 'Consiliul Judetean' });
  });

  it('fills a missing deadline from the existing date_received', () => {
    const plan = planTransition({
      current: { status: 'extension', date_received: EARLIER },
      analysis: mkAnalysis({ category: 'redirectionat' }),
      emailReceivedAt: RECEIVED_AT,
      viaThread: false,
    });
    expect(plan.changes).toEqual({ deadline_date: standardDeadline(EARLIER) });
  });
});
