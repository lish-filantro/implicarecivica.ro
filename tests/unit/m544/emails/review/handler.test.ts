/**
 * Contract tests for POST /api/emails/[id]/review: auth, body validation,
 * 404 semantics, response shape. Repos are the in-memory fakes; the auth
 * client is the minimal fake used by the other session-scoped handlers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createReviewEmailHandler, type ReviewHandlerDeps } from '@m544/emails/review/handler';
import type { AuthClient } from '@m544/shared/auth';
import { fakeAuth } from '../_fake-client';
import { FakeEmailsRepo, FakeRequestsRepo } from '../../_fakes/fake-repos';
import { FakeReviewRepo } from '../../_fakes/fake-review-repo';

const alice = { id: 'u1', email: 'alice@example.ro' } as User;
const EMAIL_ID = '11111111-1111-4111-8111-111111111111';
const REQ_ID = '22222222-2222-4222-8222-222222222222';

function build(user: User | null = alice) {
  const emails = new FakeEmailsRepo();
  const requests = new FakeRequestsRepo();
  const review = new FakeReviewRepo();
  emails.seed({
    id: EMAIL_ID,
    user_id: 'u1',
    needs_review: true,
    category: 'inregistrate',
    processing_status: 'completed',
    ai_extracted_data: { analysis: { category: 'inregistrate', registration_number: '12' } },
  });
  requests.seed({ id: REQ_ID, user_id: 'u1' });
  const deps: ReviewHandlerDeps<AuthClient> = {
    createClient: async () => ({ auth: fakeAuth(user) }),
    emails: () => emails,
    requests: () => requests,
    review: () => review,
  };
  return { handler: createReviewEmailHandler(() => deps), emails, requests, review };
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function post(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/emails/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/emails/[id]/review', () => {
  it('401 when not logged in', async () => {
    const { handler } = build(null);
    const res = await handler(post(EMAIL_ID, { action: 'dismiss' }), ctx(EMAIL_ID));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Neautorizat' });
  });

  it('400 on invalid bodies', async () => {
    const { handler, emails } = build();
    const bodies: unknown[] = [
      {},
      { action: 'nope' },
      { action: 'assign' },
      { action: 'assign', request_id: 'abc' },
      { action: 'reclassify' },
      { action: 'reclassify', category: 'spam' },
      { action: 'reclassify', category: 'raspunse', note: 'x'.repeat(501) },
      '{bad json',
    ];
    for (const body of bodies) {
      const res = await handler(post(EMAIL_ID, body), ctx(EMAIL_ID));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await emails.getById(EMAIL_ID))!.needs_review).toBe(true);
  });

  it('404 for an unknown or malformed email id', async () => {
    const { handler } = build();
    const missing = '33333333-3333-4333-8333-333333333333';
    for (const id of [missing, 'not-a-uuid']) {
      const res = await handler(post(id, { action: 'dismiss' }), ctx(id));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Emailul nu a fost găsit' });
    }
  });

  it('404 when assigning to a request that is not the user\'s', async () => {
    const { handler, requests } = build();
    requests.seed({ id: '44444444-4444-4444-8444-444444444444', user_id: 'u2' });
    const res = await handler(
      post(EMAIL_ID, { action: 'assign', request_id: '44444444-4444-4444-8444-444444444444' }),
      ctx(EMAIL_ID),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Cererea nu a fost găsită' });
  });

  it('assign: 200 with the refreshed email; the request moved to received', async () => {
    const { handler, requests } = build();
    const res = await handler(post(EMAIL_ID, { action: 'assign', request_id: REQ_ID }), ctx(EMAIL_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.email).toMatchObject({ id: EMAIL_ID, request_id: REQ_ID, needs_review: false });
    expect((await requests.getById(REQ_ID))!).toMatchObject({ status: 'received', registration_number: '12' });
  });

  it('reclassify: records the feedback with the note and returns the recategorised email', async () => {
    const { handler, review } = build();
    const res = await handler(
      post(EMAIL_ID, { action: 'reclassify', category: 'amanate', note: '  prelungire  ' }),
      ctx(EMAIL_ID),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).email).toMatchObject({ category: 'amanate', needs_review: false });
    expect(review.feedback).toEqual([
      { email_id: EMAIL_ID, user_id: 'u1', previous_category: 'inregistrate', new_category: 'amanate', note: 'prelungire' },
    ]);
  });

  it('dismiss: clears the flag', async () => {
    const { handler } = build();
    const res = await handler(post(EMAIL_ID, { action: 'dismiss' }), ctx(EMAIL_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, email: { id: EMAIL_ID, needs_review: false } });
  });

  it('500 "Eroare internă" when a repo throws (details only in the log)', async () => {
    const { handler, emails } = build();
    emails.getById = async () => {
      throw new Error('db down');
    };
    const res = await handler(post(EMAIL_ID, { action: 'dismiss' }), ctx(EMAIL_ID));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare internă' });
  });
});
