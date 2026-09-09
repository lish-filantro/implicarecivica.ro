/**
 * Contract tests for POST /api/questions/generate-set with a fake Supabase
 * client (conversation / session rows) and a scripted Anthropic client that
 * answers through the emit_questions tool. No network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from '@m544/chat/anthropic/client';
import { chatModel } from '@m544/chat/anthropic/client';
import { VALID_CATEGORIES } from '@m544/questions/prompt';
import {
  createGenerateSetHandler,
  MISSING_ID_MESSAGE,
  NO_QUESTIONS_MESSAGE,
  type GenerateSetDeps,
  type SetClient,
} from '@m544/questions/set-handler';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { fakeSupabase, byTable, type Responder, type RecordedQuery } from '../emails/_fake-client';

type Params = Anthropic.Messages.MessageCreateParamsNonStreaming;

const alice = { id: 'u1', email: 'alice@example.ro' } as User;

const FIVE = Object.fromEntries(
  VALID_CATEGORIES.map((c) => [c, Array.from({ length: 5 }, (_, i) => `${c}: vă rog să îmi furnizați documentul ${i + 1}`)]),
) as Record<(typeof VALID_CATEGORIES)[number], string[]>;

const handoff: ConversationHandoff = {
  institutionName: 'Primăria Municipiului Pitești',
  institutionEmail: 'primaria@primariapitesti.ro',
  emailConfidence: 'high',
  sourceUrl: 'https://primariapitesti.ro/contact',
  problemContext: { ce: 'groapă în asfalt', unde: 'Str. Lalelelor 5, Pitești, Argeș', cand: 'martie 2026' },
  identifiedAt: '2026-09-09T10:00:00.000Z',
  confirmedAt: '2026-09-09T10:01:00.000Z',
  sessionId: null,
  questions: null,
  questionsModel: null,
};

const messages = [
  { sender: 'user', text: 'Am o groapă mare pe Strada Lalelelor 5, Pitești, Argeș, din martie 2026' },
  { sender: 'bot', text: '✅PROBLEMA_DEFINITĂ: CE:[groapă în asfalt] UNDE:[Str. Lalelelor 5, Pitești, Argeș] DE_CÂND:[martie 2026]' },
];

function anthropic(reply: unknown | Error) {
  const calls: Params[] = [];
  const client: MessagesClient & { calls: Params[] } = {
    calls,
    messages: {
      create: async (params) => {
        calls.push(structuredClone(params));
        if (reply instanceof Error) throw reply;
        return {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: params.model,
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu_1', name: 'emit_questions', input: reply }],
        } as unknown as Anthropic.Messages.Message;
      },
    },
  };
  return client;
}

function apiError(status: number): Error {
  return Object.assign(new Error(`status ${status}`), { status });
}

function build(respond: Responder, client: MessagesClient | null = anthropic(FIVE), user: User | null = alice) {
  const sb = fakeSupabase(user, respond);
  const deps: GenerateSetDeps = {
    createClient: async () => sb as unknown as SetClient,
    createAnthropic: () => client,
  };
  return { handler: createGenerateSetHandler(() => deps), sb };
}

function post(body: unknown, query = '') {
  return new NextRequest(`http://localhost/api/questions/generate-set${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const conversationTables = (h: ConversationHandoff | null = handoff) =>
  byTable({
    'conversations:select': { data: { id: 'c1', user_id: 'u1', handoff: h } },
    'conversations:update': { data: null },
    messages: { data: messages },
  });

const updates = (queries: RecordedQuery[]) => queries.filter((q) => q.table === 'conversations' && q.op === 'update');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/questions/generate-set — guards', () => {
  it('401 when not logged in', async () => {
    const { handler } = build(conversationTables(), anthropic(FIVE), null);
    expect((await handler(post({ conversationId: 'c1' }))).status).toBe(401);
  });

  it('400 on invalid JSON and when neither id is given', async () => {
    const { handler } = build(conversationTables());
    expect((await handler(post('{nope'))).status).toBe(400);
    const res = await handler(post({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: MISSING_ID_MESSAGE });
  });

  it('404 when the conversation or the session is not the user’s', async () => {
    const { handler } = build(byTable({ conversations: { data: null }, request_sessions: { data: null } }));
    expect((await handler(post({ conversationId: 'zz' }))).status).toBe(404);
    expect((await handler(post({ sessionId: 'zz' }))).status).toBe(404);
  });

  it('503 when Anthropic is not configured', async () => {
    const { handler } = build(conversationTables(), null);
    const res = await handler(post({ conversationId: 'c1' }));
    expect(res.status).toBe(503);
  });
});

describe('POST /api/questions/generate-set — conversation', () => {
  it('generates on the chat model through the forced tool, from the transcript + hand-off, and caches on the conversation', async () => {
    const client = anthropic(FIVE);
    const { handler, sb } = build(conversationTables(), client);
    const res = await handler(post({ conversationId: 'c1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ model: chatModel(), categories: FIVE, cached: false });

    expect(client.calls).toHaveLength(1);
    const call = client.calls[0];
    expect(call.model).toBe(chatModel());
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'emit_questions' });
    expect((call.tools?.[0] as Anthropic.Messages.Tool).name).toBe('emit_questions');
    const prompt = call.messages[0].content as string;
    expect(prompt).toContain('user: Am o groapă mare');
    expect(prompt).toContain('Primăria Municipiului Pitești');
    expect(prompt).toContain('CE: groapă în asfalt');

    // ownership is enforced in the query, not only by RLS
    const select = sb.queries.find((q) => q.table === 'conversations' && q.op === 'select')!;
    expect(select.filters).toEqual([{ op: 'eq', args: ['id', 'c1'] }, { op: 'eq', args: ['user_id', 'u1'] }]);

    const [update] = updates(sb.queries);
    expect(update.payload).toEqual({ handoff: { ...handoff, questions: FIVE, questionsModel: chatModel() } });
    expect(update.filters).toEqual([{ op: 'eq', args: ['id', 'c1'] }]);
  });

  it('serves the cached set without calling the model; ?refresh=1 regenerates', async () => {
    const cached = { ...handoff, questions: FIVE, questionsModel: 'claude-sonnet-5' };
    const client = anthropic(FIVE);
    const { handler, sb } = build(conversationTables(cached), client);

    const res = await handler(post({ conversationId: 'c1' }));
    expect(await res.json()).toEqual({ model: 'claude-sonnet-5', categories: FIVE, cached: true });
    expect(client.calls).toHaveLength(0);
    expect(updates(sb.queries)).toHaveLength(0);

    const fresh = await handler(post({ conversationId: 'c1' }, '?refresh=1'));
    expect((await fresh.json()).cached).toBe(false);
    expect(client.calls).toHaveLength(1);
  });

  it('a conversation without hand-off still generates from the transcript (context extracted from the summary) and does not cache', async () => {
    const client = anthropic(FIVE);
    const { handler, sb } = build(conversationTables(null), client);
    const res = await handler(post({ conversationId: 'c1' }));
    expect(res.status).toBe(200);
    const prompt = client.calls[0].messages[0].content as string;
    expect(prompt).toContain('CE: groapă în asfalt');
    expect(prompt).toContain('INSTITUȚIE: nespecificată');
    expect(updates(sb.queries)).toHaveLength(0);
  });

  it('500 with a clear message when the tool input holds no questions', async () => {
    const { handler, sb } = build(conversationTables(), anthropic({ A_FINANCIAR: [] }));
    const res = await handler(post({ conversationId: 'c1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: NO_QUESTIONS_MESSAGE });
    expect(updates(sb.queries)).toHaveLength(0);
  });

  it('maps Anthropic 401 → 502, 429 → 429, other → 500', async () => {
    const r502 = await build(conversationTables(), anthropic(apiError(401))).handler(post({ conversationId: 'c1' }));
    expect(r502.status).toBe(502);
    const r429 = await build(conversationTables(), anthropic(apiError(429))).handler(post({ conversationId: 'c1' }));
    expect(r429.status).toBe(429);
    const r500 = await build(conversationTables(), anthropic(new Error('boom'))).handler(post({ conversationId: 'c1' }));
    expect(r500.status).toBe(500);
  });
});

describe('POST /api/questions/generate-set — session', () => {
  it('uses the institution, the already-sent questions and the linked conversation; nothing is cached', async () => {
    const client = anthropic(FIVE);
    const { handler, sb } = build(
      byTable({
        request_sessions: { data: { id: 's1', user_id: 'u1', institution_name: 'Primăria X', conversation_id: 'c1' } },
        requests: { data: [{ request_body: 'Care este bugetul pe 2025?' }, { request_body: '' }] },
        'conversations:select': { data: { id: 'c1', user_id: 'u1', handoff } },
        messages: { data: messages },
      }),
      client,
    );
    const res = await handler(post({ sessionId: 's1' }));
    expect(res.status).toBe(200);
    const prompt = client.calls[0].messages[0].content as string;
    expect(prompt).toContain('INSTITUȚIE: Primăria X');
    expect(prompt).toContain('- Care este bugetul pe 2025?');
    expect(prompt).toMatch(/NU repeta/);
    expect(prompt).toContain('user: Am o groapă mare');
    expect(updates(sb.queries)).toHaveLength(0);
  });

  it('works for a session without a linked conversation', async () => {
    const client = anthropic(FIVE);
    const { handler } = build(
      byTable({
        request_sessions: { data: { id: 's1', user_id: 'u1', institution_name: 'Primăria X', conversation_id: null } },
        requests: { data: [] },
      }),
      client,
    );
    const res = await handler(post({ sessionId: 's1' }));
    expect(res.status).toBe(200);
    const prompt = client.calls[0].messages[0].content as string;
    expect(prompt).not.toContain('Conversația cu cetățeanul');
    expect(prompt).not.toContain('NU repeta');
  });
});
