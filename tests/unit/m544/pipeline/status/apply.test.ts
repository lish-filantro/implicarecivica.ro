/**
 * pipeline/status/apply — loads the request, applies the planned transition, links the email.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyStatusUpdate } from '@m544/pipeline/status/apply';
import { standardDeadline } from '@m544/pipeline/status/deadlines';
import { FakeEmailsRepo, FakeRequestsRepo } from '../../_fakes/fake-repos';
import { mkAnalysis } from './_analysis';

const RECEIVED_AT = '2025-03-05T09:00:00.000Z';
const USER = 'user-1';

let requests: FakeRequestsRepo;
let emails: FakeEmailsRepo;

beforeEach(() => {
  requests = new FakeRequestsRepo();
  emails = new FakeEmailsRepo();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('applyStatusUpdate', () => {
  it('registers a pending request, links the email and reports the transition', async () => {
    const req = requests.seed({ user_id: USER, status: 'pending' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(
      req.id,
      email.id,
      RECEIVED_AT,
      mkAnalysis({ category: 'inregistrate', registration_number: '77/2025' }),
      { requests, emails },
    );
    expect(result).toEqual({
      previousStatus: 'pending',
      newStatus: 'received',
      needsReview: false,
      changes: {
        registration_number: '77/2025',
        date_received: RECEIVED_AT,
        deadline_date: standardDeadline(RECEIVED_AT),
        status: 'received',
      },
    });
    const stored = await requests.getById(req.id);
    expect(stored?.status).toBe('received');
    expect(stored?.registration_number).toBe('77/2025');
    const linked = await emails.getById(email.id);
    expect(linked?.request_id).toBe(req.id);
    expect(linked?.needs_review).toBeUndefined();
  });

  it('flags needs_review on the email for a suspicious pending -> answered', async () => {
    const req = requests.seed({ user_id: USER, status: 'pending' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(req.id, email.id, RECEIVED_AT, mkAnalysis({ category: 'raspunse' }), {
      requests,
      emails,
    });
    expect(result?.newStatus).toBe('received');
    expect(result?.needsReview).toBe(true);
    expect((await emails.getById(email.id))?.needs_review).toBe(true);
    expect((await requests.getById(req.id))?.status).toBe('received');
  });

  it('honours viaThread: pending -> answered without a registration number', async () => {
    const req = requests.seed({ user_id: USER, status: 'pending' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(req.id, email.id, RECEIVED_AT, mkAnalysis({ category: 'raspunse' }), {
      requests,
      emails,
      viaThread: true,
    });
    expect(result?.newStatus).toBe('answered');
    expect(result?.needsReview).toBe(false);
    expect((await emails.getById(email.id))?.needs_review).toBeUndefined();
  });

  it('returns null and touches nothing when the request does not exist', async () => {
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate('missing', email.id, RECEIVED_AT, mkAnalysis({ category: 'inregistrate' }), {
      requests,
      emails,
    });
    expect(result).toBeNull();
    expect((await emails.getById(email.id))?.request_id).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('does not downgrade an answered request but still links the email', async () => {
    const req = requests.seed({ user_id: USER, status: 'answered', answer_summary: 'final' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(
      req.id,
      email.id,
      RECEIVED_AT,
      mkAnalysis({ category: 'inregistrate', registration_number: '1' }),
      { requests, emails },
    );
    expect(result).toBeNull();
    const stored = await requests.getById(req.id);
    expect(stored?.status).toBe('answered');
    expect(stored?.registration_number).toBeUndefined();
    expect((await emails.getById(email.id))?.request_id).toBe(req.id);
  });

  it('does not link an irrelevant email to the request', async () => {
    const req = requests.seed({ user_id: USER, status: 'received' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(req.id, email.id, RECEIVED_AT, mkAnalysis({ category: 'irelevant' }), {
      requests,
      emails,
    });
    expect(result).toBeNull();
    expect((await emails.getById(email.id))?.request_id).toBeUndefined();
    expect((await requests.getById(req.id))?.status).toBe('received');
  });

  it('links the email when the plan has no changes (redirectionat already recorded)', async () => {
    const req = requests.seed({
      user_id: USER,
      status: 'received',
      date_received: RECEIVED_AT,
      deadline_date: standardDeadline(RECEIVED_AT),
    });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(req.id, email.id, RECEIVED_AT, mkAnalysis({ category: 'redirectionat' }), {
      requests,
      emails,
    });
    expect(result).toBeNull();
    expect((await emails.getById(email.id))?.request_id).toBe(req.id);
  });

  it('redirectionat stores redirected_to and keeps the request open', async () => {
    const req = requests.seed({ user_id: USER, status: 'pending' });
    const email = emails.seed({ user_id: USER });
    const result = await applyStatusUpdate(
      req.id,
      email.id,
      RECEIVED_AT,
      mkAnalysis({ category: 'redirectionat', redirected_to: 'ANAF' }),
      { requests, emails },
    );
    expect(result?.newStatus).toBe('received');
    const stored = await requests.getById(req.id);
    expect(stored?.redirected_to).toBe('ANAF');
    expect(stored?.status).toBe('received');
  });
});
