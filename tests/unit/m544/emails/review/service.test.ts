/**
 * reviewEmail: assign / reclassify / dismiss on top of the in-memory repos,
 * with the real status transition (pipeline/status) re-applied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reviewEmail, EMAIL_NOT_FOUND, REQUEST_NOT_FOUND } from '@m544/emails/review/service';
import { FakeEmailsRepo, FakeRequestsRepo } from '../../_fakes/fake-repos';
import { FakeReviewRepo } from '../../_fakes/fake-review-repo';

const RECEIVED_AT = '2026-09-01T10:00:00.000Z';

function world() {
  const emails = new FakeEmailsRepo();
  const requests = new FakeRequestsRepo();
  const review = new FakeReviewRepo();
  const req = requests.seed({ id: 'r1', user_id: 'u1', status: 'pending' });
  const email = emails.seed({
    id: 'e1',
    user_id: 'u1',
    needs_review: true,
    category: 'inregistrate',
    received_at: RECEIVED_AT,
    processing_status: 'completed',
    ai_extracted_data: { analysis: { category: 'inregistrate', registration_number: '4521', confidence: 0.9 } },
  });
  return { emails, requests, review, req, email, deps: { emails, requests, review } };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('reviewEmail - lookup', () => {
  it('404 when the email does not exist', async () => {
    const { deps } = world();
    const r = await reviewEmail({ emailId: 'nope', userId: 'u1', action: { action: 'dismiss' } }, deps);
    expect(r).toEqual({ ok: false, status: 404, error: EMAIL_NOT_FOUND });
  });

  it('404 when the email belongs to another user (defense in depth over RLS)', async () => {
    const { deps } = world();
    const r = await reviewEmail({ emailId: 'e1', userId: 'u2', action: { action: 'dismiss' } }, deps);
    expect(r).toEqual({ ok: false, status: 404, error: EMAIL_NOT_FOUND });
  });
});

describe('reviewEmail - dismiss', () => {
  it('clears needs_review and returns the refreshed email', async () => {
    const { deps, emails } = world();
    const r = await reviewEmail({ emailId: 'e1', userId: 'u1', action: { action: 'dismiss' } }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email.needs_review).toBe(false);
    expect(r.email.request_id).toBeUndefined();
    expect((await emails.getById('e1'))!.needs_review).toBe(false);
  });
});

describe('reviewEmail - assign', () => {
  it('404 when the request is missing or owned by someone else; email untouched', async () => {
    const { deps, requests, emails } = world();
    requests.seed({ id: 'r-other', user_id: 'u2' });
    for (const request_id of ['missing', 'r-other']) {
      const r = await reviewEmail({ emailId: 'e1', userId: 'u1', action: { action: 'assign', request_id } }, deps);
      expect(r).toEqual({ ok: false, status: 404, error: REQUEST_NOT_FOUND });
    }
    expect((await emails.getById('e1'))!.needs_review).toBe(true);
  });

  it('links the email, re-applies the saved analysis (pending -> received) and clears needs_review', async () => {
    const { deps, requests } = world();
    const r = await reviewEmail({ emailId: 'e1', userId: 'u1', action: { action: 'assign', request_id: 'r1' } }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toMatchObject({ request_id: 'r1', needs_review: false });
    const req = (await requests.getById('r1'))!;
    expect(req.status).toBe('received');
    expect(req.registration_number).toBe('4521');
    expect(req.date_received).toBe(RECEIVED_AT);
    expect(req.deadline_date).toBeTruthy();
  });

  it('still links the email when no analysis was saved (transition skipped)', async () => {
    const { deps, emails, requests } = world();
    emails.seed({ id: 'e2', user_id: 'u1', needs_review: true, category: null, ai_extracted_data: {} });
    const r = await reviewEmail({ emailId: 'e2', userId: 'u1', action: { action: 'assign', request_id: 'r1' } }, deps);
    expect(r.ok).toBe(true);
    expect((await emails.getById('e2'))!).toMatchObject({ request_id: 'r1', needs_review: false });
    expect((await requests.getById('r1'))!.status).toBe('pending');
  });

  it('a suspicious transition (final answer to a pending request) does not re-flag the reviewed email', async () => {
    const { deps, emails, requests } = world();
    emails.seed({
      id: 'e3',
      user_id: 'u1',
      needs_review: true,
      received_at: RECEIVED_AT,
      ai_extracted_data: { analysis: { category: 'raspunse', registration_number: null } },
    });
    const r = await reviewEmail({ emailId: 'e3', userId: 'u1', action: { action: 'assign', request_id: 'r1' } }, deps);
    expect(r.ok && r.email.needs_review).toBe(false);
    expect((await requests.getById('r1'))!.status).toBe('received');
  });

  it('falls back to created_at when received_at is missing', async () => {
    const { deps, emails, requests } = world();
    const e = emails.seed({ id: 'e4', user_id: 'u1', ai_extracted_data: { analysis: { category: 'inregistrate' } } });
    await reviewEmail({ emailId: 'e4', userId: 'u1', action: { action: 'assign', request_id: 'r1' } }, deps);
    expect((await requests.getById('r1'))!.date_received).toBe(e.created_at);
  });
});

describe('reviewEmail - reclassify', () => {
  it('records feedback, writes the category and clears needs_review; unlinked email -> no transition', async () => {
    const { deps, review, emails } = world();
    const r = await reviewEmail(
      { emailId: 'e1', userId: 'u1', action: { action: 'reclassify', category: 'amanate', note: 'e prelungire' } },
      deps,
    );
    expect(r.ok && r.email).toMatchObject({ category: 'amanate', needs_review: false });
    expect(review.feedback).toEqual([
      { email_id: 'e1', user_id: 'u1', previous_category: 'inregistrate', new_category: 'amanate', note: 'e prelungire' },
    ]);
    expect((await emails.getById('e1'))!.request_id).toBeUndefined();
  });

  it('stores a null note and null previous category when absent', async () => {
    const { deps, review, emails } = world();
    emails.seed({ id: 'e5', user_id: 'u1', category: null });
    await reviewEmail({ emailId: 'e5', userId: 'u1', action: { action: 'reclassify', category: 'raspunse' } }, deps);
    expect(review.feedback[0]).toMatchObject({ previous_category: null, new_category: 'raspunse', note: null });
  });

  it('linked email: re-applies the transition with the corrected category', async () => {
    const { deps, emails, requests } = world();
    await emails.update('e1', { request_id: 'r1' });
    await requests.update('r1', { status: 'received', date_received: RECEIVED_AT, registration_number: '4521' });
    const r = await reviewEmail(
      { emailId: 'e1', userId: 'u1', action: { action: 'reclassify', category: 'raspunse' } },
      deps,
    );
    expect(r.ok && r.email).toMatchObject({ category: 'raspunse', request_id: 'r1', needs_review: false });
    const req = (await requests.getById('r1'))!;
    expect(req.status).toBe('answered');
    expect(req.response_received_date).toBe(RECEIVED_AT);
  });

  it('linked email without saved analysis: uses a minimal analysis built from the new category', async () => {
    const { deps, emails, requests } = world();
    emails.seed({
      id: 'e6',
      user_id: 'u1',
      request_id: 'r1',
      category: 'irelevant',
      registration_number: '88',
      ai_extracted_data: {},
    });
    await reviewEmail({ emailId: 'e6', userId: 'u1', action: { action: 'reclassify', category: 'inregistrate' } }, deps);
    const req = (await requests.getById('r1'))!;
    expect(req.status).toBe('received');
    expect(req.registration_number).toBe('88');
  });

  it('irelevant unlinks the email from its request and leaves the request alone', async () => {
    const { deps, emails, requests } = world();
    await emails.update('e1', { request_id: 'r1' });
    const r = await reviewEmail(
      { emailId: 'e1', userId: 'u1', action: { action: 'reclassify', category: 'irelevant' } },
      deps,
    );
    expect(r.ok && r.email).toMatchObject({ category: 'irelevant', request_id: null, needs_review: false });
    expect((await requests.getById('r1'))!.status).toBe('pending');
  });
});
