// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversation, SERVER_ERROR_TEXT, REJECT_INSTITUTION_TEXT } from '@m544/ui/chat/hooks/useConversation';
import type { FetchLike } from '@m544/ui/chat/hooks/useChatApi';
import { fakeQueries, fakeRouter, persisted, STEP_2_REPLY, STEP_2_INSTITUTION, HANDOFF } from './_fakes';

const router = fakeRouter();
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function fakeFetch(reply: () => Response) {
  const posts: Array<Record<string, unknown>> = [];
  const fetchImpl: FetchLike = async (_input, init) => {
    if (init?.method !== 'POST') return jsonResponse({ anthropicConfigured: true });
    posts.push(JSON.parse(init.body as string));
    return reply();
  };
  return { fetchImpl, posts };
}

async function send(result: { current: ReturnType<typeof useConversation> }, text: string) {
  act(() => result.current.setInputMessage(text));
  await act(async () => {
    await result.current.sendMessage();
  });
}

describe('useConversation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    router.push.mockClear();
  });

  it('has the same return shape as before the split', () => {
    const { queries } = fakeQueries();
    const { fetchImpl } = fakeFetch(() => jsonResponse({}));
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));
    expect(Object.keys(result.current).sort()).toEqual(
      [
        'messages', 'inputMessage', 'setInputMessage', 'sendMessage', 'isTyping', 'aiStatus',
        'isLoading', 'conversationId', 'startNewConversation', 'handoff', 'confirmHandoff', 'rejectInstitution',
        'failedMessage', 'retryLastMessage',
      ].sort(),
    );
  });

  it('happy path: optimistic user message, bot reply appended, conversation created and URL rewritten', async () => {
    const { queries, saved, handoffs } = fakeQueries();
    const { fetchImpl, posts } = fakeFetch(() =>
      jsonResponse({ response: STEP_2_REPLY, sources: [{ url: 'https://p.ro', title: 'P' }], institution: STEP_2_INSTITUTION }),
    );
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));
    await waitFor(() => expect(result.current.aiStatus).toBe('configured'));

    await send(result, 'Groapă pe strada mea');

    expect(result.current.inputMessage).toBe('');
    expect(result.current.isTyping).toBe(false);
    expect(result.current.failedMessage).toBeNull();
    expect(result.current.messages.map((m) => m.sender)).toEqual(['bot', 'user', 'bot']);
    expect(result.current.messages[2]).toMatchObject({
      text: STEP_2_REPLY,
      webSources: [{ url: 'https://p.ro', title: 'P' }],
      webSearches: [],
    });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/chat/conv-new');
    expect(result.current.conversationId).toBe('conv-new');
    expect(posts[0]).toEqual({
      message: 'Groapă pe strada mea',
      conversationHistory: [{ role: 'user', content: 'Groapă pe strada mea' }],
      conversationId: 'conv-new',
    });
    await waitFor(() => expect(saved.map((s) => s.seq)).toEqual([1, 2]));
    await waitFor(() => expect(result.current.handoff?.institutionName).toBe('Primăria Municipiului Pitești'));
    expect(result.current.handoff).toMatchObject({
      institutionEmail: 'primaria@primariapitesti.ro',
      emailConfidence: 'high',
      confirmedAt: null,
      problemContext: { ce: '', unde: '', cand: '' },
    });
    expect(handoffs).toEqual([{ convId: 'conv-new', handoff: result.current.handoff }]);
  });

  it('sends only the last 10 history entries (including the new message)', async () => {
    const existing = Array.from({ length: 12 }, (_, i) =>
      persisted(`m${i}`, i % 2 === 0 ? 'user' : 'bot', `msg ${i}`),
    );
    const { queries } = fakeQueries(existing);
    const { fetchImpl, posts } = fakeFetch(() => jsonResponse({ response: 'ok' }));
    const { result } = renderHook(() =>
      useConversation({ conversationId: 'conv-1', fetchImpl, queries }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await send(result, 'ultimul');

    const history = posts[0].conversationHistory as Array<{ role: string; content: string }>;
    expect(history).toHaveLength(10);
    expect(history.at(-1)).toEqual({ role: 'user', content: 'ultimul' });
    expect(history[0]).toEqual({ role: 'assistant', content: 'msg 3' });
  });

  it('401 (session expired) shows the existing error bubble and enables retry', async () => {
    const { queries } = fakeQueries();
    const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'Unauthorized' }, 401));
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));

    await send(result, 'salut');

    const last = result.current.messages.at(-1)!;
    expect(last).toMatchObject({ sender: 'bot', text: SERVER_ERROR_TEXT, isError: true });
    expect(result.current.failedMessage).toBe('salut');
    expect(result.current.isTyping).toBe(false);

    act(() => result.current.retryLastMessage());
    expect(result.current.inputMessage).toBe('salut');
    expect(result.current.failedMessage).toBeNull();
    expect(result.current.messages.some((m) => m.isError)).toBe(false);
  });

  it('ignores empty input and does nothing while typing', async () => {
    const { queries } = fakeQueries();
    const { fetchImpl, posts } = fakeFetch(() => jsonResponse({ response: 'ok' }));
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));
    await send(result, '   ');
    expect(posts).toHaveLength(0);
    expect(result.current.messages).toHaveLength(1);
  });

  it('startNewConversation clears state and navigates to /chat', () => {
    const { queries } = fakeQueries();
    const { fetchImpl } = fakeFetch(() => jsonResponse({}));
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));
    act(() => result.current.startNewConversation());
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/chat');
  });

  it('confirmHandoff marks the hand-off confirmed, writes STEP_3 and resolves to the conversation id', async () => {
    const { queries, steps, handoffs } = fakeQueries(
      [persisted('m1', 'user', 'groapă'), persisted('m2', 'bot', STEP_2_REPLY)],
      HANDOFF,
    );
    const { fetchImpl } = fakeFetch(() => jsonResponse({}));
    const { result } = renderHook(() => useConversation({ conversationId: 'conv-1', fetchImpl, queries }));
    await waitFor(() => expect(result.current.handoff).toEqual(HANDOFF));

    let id: string | null = null;
    await act(async () => {
      id = await result.current.confirmHandoff();
    });
    expect(id).toBe('conv-1');
    expect(result.current.handoff?.confirmedAt).toBeTruthy();
    expect(handoffs.at(-1)).toEqual({ convId: 'conv-1', handoff: result.current.handoff });
    expect(steps).toEqual([{ convId: 'conv-1', step: 'STEP_3' }]);
  });

  it('rejectInstitution sends the fixed "search again" message as a normal turn', async () => {
    const { queries } = fakeQueries();
    const { fetchImpl, posts } = fakeFetch(() => jsonResponse({ response: 'Caut altă instituție responsabilă.' }));
    const { result } = renderHook(() => useConversation({ fetchImpl, queries }));

    await act(async () => {
      await result.current.rejectInstitution();
    });
    expect(posts[0].message).toBe(REJECT_INSTITUTION_TEXT);
    expect(result.current.messages.map((m) => m.sender)).toEqual(['bot', 'user', 'bot']);
    expect(result.current.messages[1].text).toBe(REJECT_INSTITUTION_TEXT);
  });
});
