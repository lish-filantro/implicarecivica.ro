/**
 * Contract tests for the session routes:
 *   POST /api/sessions/create, POST /api/sessions/[id]/add-requests, GET /api/rate-limit/check
 * Auth (401), validation (400), daily limit (429, incl. the institution-name
 * fallback when there is no email), ownership (404) and 200 response shapes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  createSessionsCreateHandler,
  createAddRequestsHandler,
  createRateLimitCheckHandler,
  type SessionsDeps,
} from '@m544/requests/sessions/handlers';
import { DAILY_LIMIT, startOfToday } from '@m544/shared/rate-limit';
import { FakeSessionsRepo, FakeSentCounter, fakeAuthClient, alice, bob } from './_fakes';

function setup(user: User | null = alice) {
  const repo = new FakeSessionsRepo();
  const counter = new FakeSentCounter();
  const deps: SessionsDeps = {
    createClient: async () => fakeAuthClient(user),
    sessionsRepo: () => repo,
    sentCounter: () => counter,
  };
  return { repo, counter, getDeps: () => deps };
}

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const validCreate = {
  name: 'Sesiune test',
  subject: 'Cerere informații publice - Legea 544/2001',
  institution_name: 'Primăria Pitești',
  institution_email: 'Registratura@Primaria-Pitesti.RO',
  conversation_id: 'conv-1',
  questions: ['Câte autorizații de construire ați emis în 2025?', 'Care este bugetul pe 2026?'],
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/sessions/create', () => {
  it('401 when there is no session', async () => {
    const { getDeps } = setup(null);
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Neautorizat' });
  });

  it('400 with the legacy message when subject / institution_name / questions are missing or empty', async () => {
    const { getDeps } = setup();
    const h = createSessionsCreateHandler(getDeps);
    const msg = 'Câmpuri lipsă: subject, institution_name, questions sunt obligatorii';
    for (const body of [
      { ...validCreate, subject: undefined },
      { ...validCreate, institution_name: '' },
      { ...validCreate, questions: undefined },
      { ...validCreate, questions: [] },
    ]) {
      const res = await h(post('/api/sessions/create', body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(msg);
    }
  });

  it('400 on malformed JSON and on wrongly typed fields', async () => {
    const { getDeps } = setup();
    const h = createSessionsCreateHandler(getDeps);
    expect((await h(post('/api/sessions/create', '{nope'))).status).toBe(400);
    expect((await h(post('/api/sessions/create', { ...validCreate, questions: 'una' }))).status).toBe(400);
    expect((await h(post('/api/sessions/create', { ...validCreate, questions: [1, 2] }))).status).toBe(400);
  });

  it('429 with { error, sent_today, remaining, limit } when the daily limit is exceeded', async () => {
    const { getDeps, counter, repo } = setup();
    counter.set('registratura@primaria-pitesti.ro', 9);
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'Ai atins limita de cereri către această instituție azi. Mai poți trimite 1.',
      sent_today: 9,
      remaining: 1,
      limit: DAILY_LIMIT,
    });
    expect(repo.sessions.size).toBe(0);
    expect(repo.requests).toHaveLength(0);
  });

  it('applies the limit by institution name when institution_email is missing (fix)', async () => {
    const { getDeps, counter } = setup();
    counter.set('name:primăria pitești', DAILY_LIMIT);
    const body = { ...validCreate, institution_email: undefined };
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', body));
    expect(res.status).toBe(429);
    expect((await res.json()).remaining).toBe(0);
  });

  it('counter errors are no longer swallowed: 500, nothing created', async () => {
    const { getDeps, counter, repo } = setup();
    counter.error = new Error('db down');
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(500);
    expect(repo.sessions.size).toBe(0);
  });

  it('200: creates the session and one pending request per question', async () => {
    const { getDeps, counter } = setup();
    counter.set('registratura@primaria-pitesti.ro', 3);
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.session).toMatchObject({
      user_id: alice.id,
      name: 'Sesiune test',
      subject: validCreate.subject,
      institution_name: 'Primăria Pitești',
      institution_email: validCreate.institution_email,
      conversation_id: 'conv-1',
      total_requests: 2,
    });
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toMatchObject({
      user_id: alice.id,
      session_id: body.session.id,
      institution_name: 'Primăria Pitești',
      institution_email: validCreate.institution_email,
      subject: validCreate.subject,
      request_body: validCreate.questions[0],
      status: 'pending',
    });
    expect(body.requests[1].request_body).toBe(validCreate.questions[1]);
    expect(body.requests[0].date_initiated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The counter is keyed on the normalized email and counts from local midnight.
    expect(counter.calls).toEqual([
      { userId: alice.id, key: 'registratura@primaria-pitesti.ro', sinceIso: startOfToday() },
    ]);
  });

  it('200: optional fields default to null, like the legacy route', async () => {
    const { getDeps, repo } = setup();
    const body = { subject: 'S', institution_name: 'Prefectura Argeș', questions: ['Q?'] };
    const res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', body));
    expect(res.status).toBe(200);
    const inserted = [...repo.sessions.values()][0];
    expect(inserted.name).toBeUndefined();
    expect(inserted.institution_email).toBeUndefined();
    expect(inserted.conversation_id).toBeUndefined();
    expect(repo.requests[0].institution_email).toBeUndefined();
  });

  it('500 with the legacy messages when inserts fail', async () => {
    const { getDeps, repo } = setup();
    repo.failOn.insertSession = new Error('rls');
    let res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Eroare la crearea sesiunii');

    repo.failOn = { insertRequests: new Error('rls') };
    res = await createSessionsCreateHandler(getDeps)(post('/api/sessions/create', validCreate));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Eroare la crearea cererilor');
  });
});

describe('POST /api/sessions/[id]/add-requests', () => {
  const seed = (repo: FakeSessionsRepo, overrides: Partial<Parameters<FakeSessionsRepo['seedSession']>[0]> = {}) =>
    repo.seedSession({
      user_id: alice.id,
      subject: 'Subiect sesiune',
      institution_name: 'Consiliul Județean Argeș',
      institution_email: 'office@cjarges.ro',
      total_requests: 3,
      ...overrides,
    });
  const add = (id: string, body: unknown) => post(`/api/sessions/${id}/add-requests`, body);

  it('401 when there is no session', async () => {
    const { getDeps, repo } = setup(null);
    const s = seed(repo);
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['Q?'] }), ctx(s.id));
    expect(res.status).toBe(401);
  });

  it('400 with the legacy message when questions are missing or empty', async () => {
    const { getDeps, repo } = setup();
    const s = seed(repo);
    const h = createAddRequestsHandler(getDeps);
    const msg = 'Câmpul "questions" este obligatoriu și trebuie să conțină cel puțin o întrebare';
    for (const body of [{}, { questions: [] }]) {
      const res = await h(add(s.id, body), ctx(s.id));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(msg);
    }
    expect((await h(add(s.id, '{bad'), ctx(s.id))).status).toBe(400);
  });

  it('404 for another user\'s session and for an unknown id', async () => {
    const { getDeps, repo } = setup();
    const theirs = seed(repo, { user_id: bob.id });
    const h = createAddRequestsHandler(getDeps);
    let res = await h(add(theirs.id, { questions: ['Q?'] }), ctx(theirs.id));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Sesiunea nu a fost găsită' });
    res = await h(add('nope', { questions: ['Q?'] }), ctx('nope'));
    expect(res.status).toBe(404);
    expect(repo.requests).toHaveLength(0);
  });

  it('429 based on the session institution email', async () => {
    const { getDeps, repo, counter } = setup();
    const s = seed(repo);
    counter.set('office@cjarges.ro', 8);
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['a', 'b', 'c'] }), ctx(s.id));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: 'Ai atins limita de cereri către această instituție azi. Mai poți trimite 2.',
      sent_today: 8,
      remaining: 2,
      limit: DAILY_LIMIT,
    });
    expect(repo.requests).toHaveLength(0);
  });

  it('429 by institution name when the session has no email (fix)', async () => {
    const { getDeps, repo, counter } = setup();
    const s = seed(repo, { institution_email: undefined });
    counter.set('name:consiliul județean argeș', DAILY_LIMIT);
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['a'] }), ctx(s.id));
    expect(res.status).toBe(429);
  });

  it('500 when the counter fails', async () => {
    const { getDeps, repo, counter } = setup();
    const s = seed(repo);
    counter.error = new Error('boom');
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['a'] }), ctx(s.id));
    expect(res.status).toBe(500);
  });

  it('200: requests inherit the session fields; total_requests is updated', async () => {
    const { getDeps, repo } = setup();
    const s = seed(repo);
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['Q1?', 'Q2?'] }), ctx(s.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toMatchObject({
      user_id: alice.id,
      session_id: s.id,
      institution_name: 'Consiliul Județean Argeș',
      institution_email: 'office@cjarges.ro',
      subject: 'Subiect sesiune',
      request_body: 'Q1?',
      status: 'pending',
    });
    expect(body.session.id).toBe(s.id);
    expect(body.session.total_requests).toBe(5);
    expect(repo.sessions.get(s.id)?.total_requests).toBe(5);
  });

  it('500 with the legacy message when the insert fails', async () => {
    const { getDeps, repo } = setup();
    const s = seed(repo);
    repo.failOn.insertRequests = new Error('rls');
    const res = await createAddRequestsHandler(getDeps)(add(s.id, { questions: ['a'] }), ctx(s.id));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Eroare la crearea cererilor');
  });
});

describe('GET /api/rate-limit/check', () => {
  const get = (qs: string) => new NextRequest(`http://localhost/api/rate-limit/check${qs}`);

  it('401 when there is no session', async () => {
    const { getDeps } = setup(null);
    expect((await createRateLimitCheckHandler(getDeps)(get('?email=a@b.ro'))).status).toBe(401);
  });

  it('400 with the legacy message when neither email nor name is given', async () => {
    const { getDeps } = setup();
    const res = await createRateLimitCheckHandler(getDeps)(get(''));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Parametrul "email" este obligatoriu' });
  });

  it('200 { sent_today, remaining, limit } for an email', async () => {
    const { getDeps, counter } = setup();
    counter.set('office@cjarges.ro', 4);
    const res = await createRateLimitCheckHandler(getDeps)(get('?email=Office@CJArges.ro'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent_today: 4, remaining: 6, limit: DAILY_LIMIT });
    expect(counter.calls[0]).toMatchObject({ userId: alice.id, key: 'office@cjarges.ro' });
  });

  it('200 by institution name when there is no email', async () => {
    const { getDeps, counter } = setup();
    counter.set('name:primăria pitești', 10);
    const res = await createRateLimitCheckHandler(getDeps)(get('?name=Prim%C4%83ria%20Pite%C8%99ti'));
    expect(await res.json()).toEqual({ sent_today: 10, remaining: 0, limit: DAILY_LIMIT });
  });

  it('500 when the counter fails', async () => {
    const { getDeps, counter } = setup();
    counter.error = new Error('boom');
    expect((await createRateLimitCheckHandler(getDeps)(get('?email=a@b.ro'))).status).toBe(500);
  });
});
