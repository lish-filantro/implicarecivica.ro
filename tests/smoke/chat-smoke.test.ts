/**
 * Smoke test — real Anthropic (Haiku + web search) through the chat handler.
 *
 * Skipped unless RUN_SMOKE=1 (costs tokens + web searches). Auth is simulated
 * with a fake session client; everything else is the production code path.
 *
 *   RUN_SMOKE=1 npx vitest run tests/smoke/chat-smoke.test.ts
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createChatHandler } from '@m544/chat/handler';
import { createAnthropicClient } from '@m544/chat/anthropic/client';

const RUN = process.env.RUN_SMOKE === '1';

const fakeUser = { id: 'smoke-user', email: 'smoke@implicarecivica.ro' } as User;
const deps = () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: fakeUser }, error: null }) } }),
  createAnthropic: createAnthropicClient,
});

function post(body: unknown) {
  return new NextRequest('http://localhost/api/chat-haiku', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!RUN)('chat smoke (real Anthropic)', () => {
  it('STEP_1: asks for the missing address/date details', async () => {
    const res = await createChatHandler(deps)(post({ message: 'Este o groapă mare în asfalt pe strada mea de 3 luni', conversationHistory: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    console.log('[smoke STEP_1]', body._debug, body.response.slice(0, 300));
    expect(body._debug.step).toBe('STEP_1');
    expect(body.response.length).toBeGreaterThan(20);
  }, 120_000);

  it('STEP_2: identifies the institution via rag_search and finds an email via web_search', async () => {
    const history = [
      { role: 'user', content: 'Este o groapă mare în asfalt pe strada mea' },
      { role: 'assistant', content: 'Îmi puteți spune adresa completă (stradă, număr, localitate, județ) și de când există problema?' },
      { role: 'user', content: 'Strada Libertății nr. 45, Pitești, județul Argeș, din martie 2024' },
      {
        role: 'assistant',
        content:
          '✅PROBLEMA_DEFINITĂ: CE:[groapă mare în asfalt pe carosabil] UNDE:[Strada Libertății nr. 45, Pitești, Argeș] DE_CÂND:[martie 2024]. Confirmă că e corect.',
      },
    ];
    const res = await createChatHandler(deps)(post({ message: 'Da, corect, confirm.', conversationHistory: history }));
    expect(res.status).toBe(200);
    const body = await res.json();
    console.log('[smoke STEP_2]', body._debug, 'toolIterations=', body.toolIterations, 'webSearchCount=', body.webSearchCount);
    console.log(body.response.slice(0, 1200));
    console.log('sources:', body.sources.map((s: { url: string }) => s.url).slice(0, 6));
    expect(body._debug.step).toBe('STEP_2');
    expect(body._debug.context.localitate).toBe('Pitești');
    expect(body.response).toMatch(/INSTITUȚIE_IDENTIFICATĂ/);
    expect(body.response).toMatch(/Pitești/);
    expect(body.toolIterations).toBeGreaterThanOrEqual(1); // rag_search was called
    expect(body.response).toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.ro/i); // an email was found
  }, 180_000);
});
