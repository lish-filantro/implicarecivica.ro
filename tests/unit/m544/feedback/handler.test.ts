/**
 * Contract tests for POST /api/feedback (src/manager-544/feedback/handler.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createFeedbackHandler, type FeedbackDeps } from '@m544/feedback/handler';
import { SupabaseFeedbackStore } from '@m544/feedback/store';
import { fakeSupabase, byTable, type QueryResult, type RecordedQuery } from '../emails/_fake-client';

const alice = { id: 'u1', email: 'a@b.ro' } as User;

function build(user: User | null = alice, insert?: QueryResult) {
  const sb = fakeSupabase(
    user,
    byTable({
      'feedback:insert':
        insert ?? ((q: RecordedQuery) => ({ data: { id: 'f1', status: 'nou', ...(q.payload as object) }, error: null })),
    }),
  );
  const deps: FeedbackDeps = {
    createClient: async () => sb as unknown as SupabaseClient,
    store: (c) => new SupabaseFeedbackStore(c),
  };
  return { handler: createFeedbackHandler(() => deps), sb };
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/feedback', () => {
  it('401 when not logged in', async () => {
    expect((await build(null).handler(post({ category: 'bug', message: 'ceva nu merge' }))).status).toBe(401);
  });

  it('400 on missing fields / invalid category / short message / bad JSON', async () => {
    const { handler, sb } = build();
    expect((await handler(post({}))).status).toBe(400);
    expect((await handler(post({ category: 'bug' }))).status).toBe(400);
    const cat = await handler(post({ category: 'spam', message: 'mesaj valid' }));
    expect(cat.status).toBe(400);
    expect((await cat.json()).error).toMatch(/Categorie invalidă/);
    const short = await handler(post({ category: 'bug', message: '  ab  ' }));
    expect(short.status).toBe(400);
    expect((await short.json()).error).toMatch(/cel puțin 5 caractere/);
    expect((await handler(post('{x'))).status).toBe(400);
    expect(sb.queries).toHaveLength(0);
  });

  it('500 when the insert fails', async () => {
    const { handler } = build(alice, { data: null, error: { message: 'rls' } });
    const res = await handler(post({ category: 'bug', message: 'ceva nu merge' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare la salvarea feedbackului' });
  });

  it('200 with the saved row; message trimmed, page_url null when absent', async () => {
    const { handler, sb } = build();
    const res = await handler(post({ category: 'sugestie', message: '  Ar fi util un export CSV.  ' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.feedback).toMatchObject({ id: 'f1', category: 'sugestie', message: 'Ar fi util un export CSV.' });
    expect(sb.queries[0]).toMatchObject({
      table: 'feedback',
      op: 'insert',
      payload: { user_id: 'u1', category: 'sugestie', message: 'Ar fi util un export CSV.', page_url: null },
    });
    expect(sb.queries[0].modifiers).toContain('single');
  });

  it('stores page_url when given', async () => {
    const { handler, sb } = build();
    await handler(post({ category: 'utilizare', message: 'unde găsesc X?', page_url: '/dashboard' }));
    expect(sb.queries[0].payload).toMatchObject({ page_url: '/dashboard' });
  });
});
