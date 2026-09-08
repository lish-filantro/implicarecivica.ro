/**
 * Contract tests for POST /api/questions/generate with a fake Anthropic client.
 * Response mapping must stay identical to the legacy route:
 *   401 no session · 400 bad body/category/context · 503 not configured ·
 *   502 Anthropic 401 · 429 Anthropic 429 · 500 anything else · 200 { category, questions }.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  createGenerateQuestionsHandler,
  type GenerateQuestionsDeps,
  type AnthropicClient,
  type MessageCreateArgs,
} from '@m544/questions/handler';
import { HAIKU_MODEL, SYSTEM_PROMPT } from '@m544/questions/prompt';
import { EnvError } from '@m544/shared/env';
import { fakeSupabase } from '../emails/_fake-client';

const alice = { id: 'u1', email: 'a@b.ro' } as User;

const TEN = Array.from({ length: 12 }, (_, i) => `${i + 1}. Vă rog să îmi furnizați documentul numărul ${i + 1} din dosar.`).join('\n');

function anthropic(reply: string | Error) {
  const calls: MessageCreateArgs[] = [];
  const client: AnthropicClient & { calls: MessageCreateArgs[] } = {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        if (reply instanceof Error) throw reply;
        return { content: [{ type: 'text', text: reply }, { type: 'tool_use' }] };
      },
    },
  };
  return client;
}

function build(client: AnthropicClient = anthropic(TEN), user: User | null = alice) {
  const deps: GenerateQuestionsDeps = { createClient: async () => fakeSupabase(user), anthropic: client };
  return createGenerateQuestionsHandler(() => deps);
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/questions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = {
  category: 'A_FINANCIAR',
  problemContext: { ce: 'groapă în asfalt', unde: 'str. Lungă 5', cand: 'martie' },
  institutionName: 'Primăria Brașov',
};

function apiError(status: number): Error {
  const e = new Error(`status ${status}`) as Error & { status: number };
  e.status = status;
  return e;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/questions/generate', () => {
  it('401 when not logged in', async () => {
    const res = await build(anthropic(TEN), null)(post(valid));
    expect(res.status).toBe(401);
  });

  it('400 on invalid JSON', async () => {
    const res = await build()(post('{nope'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Body JSON invalid' });
  });

  it('400 on unknown category, listing the valid ones', async () => {
    const res = await build()(post({ ...valid, category: 'F_ALTCEVA' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Categorie invalidă.*A_FINANCIAR.*E_CONFORMITATE/);
  });

  it('400 when problemContext.ce or .unde is missing', async () => {
    const h = build();
    expect((await h(post({ ...valid, problemContext: { unde: 'x' } }))).status).toBe(400);
    expect((await h(post({ ...valid, problemContext: { ce: 'x', unde: '   ' } }))).status).toBe(400);
    expect((await h(post({ category: 'A_FINANCIAR' }))).status).toBe(400);
  });

  it('503 when the Anthropic key is not configured (lazy default throws EnvError)', async () => {
    const deps: GenerateQuestionsDeps = {
      createClient: async () => fakeSupabase(alice),
      get anthropic(): AnthropicClient {
        throw new EnvError('ANTHROPIC_API_KEY', 'is required but not set');
      },
    };
    const res = await createGenerateQuestionsHandler(() => deps)(post(valid));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      category: 'A_FINANCIAR',
      questions: [],
      error: 'Serviciul de generare nu este configurat',
    });
  });

  it('200 with at most 10 parsed questions and the right model call', async () => {
    const client = anthropic(TEN);
    const res = await build(client)(post(valid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.category).toBe('A_FINANCIAR');
    expect(body.questions).toHaveLength(10);
    expect(body.questions[0]).toBe('Vă rog să îmi furnizați documentul numărul 1 din dosar.');

    expect(client.calls).toHaveLength(1);
    const args = client.calls[0];
    expect(args).toMatchObject({ model: HAIKU_MODEL, max_tokens: 1500, temperature: 0.5, system: SYSTEM_PROMPT });
    expect(args.messages).toHaveLength(1);
    expect(args.messages[0].role).toBe('user');
    expect(args.messages[0].content).toContain('- CE: groapă în asfalt');
    expect(args.messages[0].content).toContain('- INSTITUȚIE: Primăria Brașov');
  });

  it('clips oversized inputs before they reach the prompt', async () => {
    const client = anthropic(TEN);
    await build(client)(post({ ...valid, problemContext: { ce: 'x'.repeat(2000), unde: 'y'.repeat(1000) } }));
    const content = client.calls[0].messages[0].content;
    expect(content).toContain(`- CE: ${'x'.repeat(600)}\n`);
    expect(content).toContain(`- UNDE: ${'y'.repeat(300)}\n`);
  });

  it('200 with empty list when the model returns nothing usable', async () => {
    const res = await build(anthropic('Categoria nu se aplică acestei probleme.\n- n/a\n'))(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ category: 'A_FINANCIAR', questions: [] });
  });

  it('maps Anthropic 401 → 502, 429 → 429, other errors → 500', async () => {
    const r401 = await build(anthropic(apiError(401)))(post(valid));
    expect(r401.status).toBe(502);
    expect(await r401.json()).toEqual({ category: 'unknown', questions: [], error: 'Cheia Anthropic este invalidă' });

    const r429 = await build(anthropic(apiError(429)))(post(valid));
    expect(r429.status).toBe(429);
    expect((await r429.json()).error).toMatch(/Limită de rată/);

    const r500 = await build(anthropic(new Error('network')))(post(valid));
    expect(r500.status).toBe(500);
    expect(await r500.json()).toEqual({ category: 'unknown', questions: [], error: 'Eroare la generarea întrebărilor' });
  });
});
