// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChatApi, getChatEndpoint, type FetchLike } from '@m544/ui/chat/hooks/useChatApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Fake fetch: GET answers the health check, POST answers with `reply`. */
function fakeFetch(health: unknown, reply: () => Response) {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return init?.method === 'POST' ? reply() : jsonResponse(health);
  };
  return { fetchImpl, calls };
}

const body = { message: 'salut', conversationHistory: [], conversationId: 'c1' };

async function settled(fetchImpl: FetchLike) {
  const hook = renderHook(() => useChatApi({ fetchImpl }));
  await waitFor(() => expect(hook.result.current.aiStatus).not.toBe('loading'));
  return hook;
}

describe('useChatApi', () => {
  it('reports configured when the health check says anthropicConfigured', async () => {
    const { fetchImpl, calls } = fakeFetch({ anthropicConfigured: true }, () => jsonResponse({}));
    const { result } = renderHook(() => useChatApi({ fetchImpl }));
    expect(result.current.aiStatus).toBe('loading');
    await waitFor(() => expect(result.current.aiStatus).toBe('configured'));
    expect(calls[0].input).toBe(getChatEndpoint());
  });

  it('reports mock when the health check fails or says not configured', async () => {
    const failing: FetchLike = async () => { throw new Error('offline'); };
    const { result: r1 } = renderHook(() => useChatApi({ fetchImpl: failing }));
    await waitFor(() => expect(r1.current.aiStatus).toBe('mock'));

    const { fetchImpl } = fakeFetch({ aiConfigured: false }, () => jsonResponse({}));
    const { result: r2 } = renderHook(() => useChatApi({ fetchImpl }));
    await waitFor(() => expect(r2.current.aiStatus).toBe('mock'));
  });

  it('posts the body as JSON and returns response, sources, webSearches', async () => {
    const { fetchImpl, calls } = fakeFetch({}, () =>
      jsonResponse({ response: 'Bună!', sources: [{ url: 'https://x.ro', title: 'X' }] }),
    );
    const { result } = await settled(fetchImpl);
    const reply = await result.current.sendChatMessage(body);

    expect(reply).toEqual({
      response: 'Bună!',
      sources: [{ url: 'https://x.ro', title: 'X' }],
      webSearches: [],
    });
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(post.input).toBe(getChatEndpoint());
    expect(post.init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(post.init?.body as string)).toEqual(body);
  });

  it('throws "API error: 401" when the session expired', async () => {
    const { fetchImpl } = fakeFetch({}, () => jsonResponse({ error: 'Unauthorized' }, 401));
    const { result } = await settled(fetchImpl);
    await expect(result.current.sendChatMessage(body)).rejects.toThrow('API error: 401');
  });

  it('throws "API error: 500" on a server error', async () => {
    const { fetchImpl } = fakeFetch({}, () => jsonResponse({ error: 'boom' }, 500));
    const { result } = await settled(fetchImpl);
    await expect(result.current.sendChatMessage(body)).rejects.toThrow('API error: 500');
  });

  it('throws on an empty response', async () => {
    const { fetchImpl } = fakeFetch({}, () => jsonResponse({ response: '   ' }));
    const { result } = await settled(fetchImpl);
    await expect(result.current.sendChatMessage(body)).rejects.toThrow('Răspuns gol de la API');
  });

  it('uses the default fetch when none is injected', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ aiConfigured: true }));
    const { result } = renderHook(() => useChatApi());
    await waitFor(() => expect(result.current.aiStatus).toBe('configured'));
    expect(spy).toHaveBeenCalledWith(getChatEndpoint(), undefined);
    spy.mockRestore();
  });
});
