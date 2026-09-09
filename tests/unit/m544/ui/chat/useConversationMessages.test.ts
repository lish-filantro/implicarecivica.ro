// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useConversationMessages,
  detectStepFromReply,
  WELCOME_TEXT,
} from '@m544/ui/chat/hooks/useConversationMessages';
import type { Message } from '@m544/shared/types/chat';
import { fakeQueries, fakeRouter, persisted, STEP_2_REPLY } from './_fakes';

const userMsg = (text: string): Message => ({ sender: 'user', text, time: '10:01' });
const botMsg = (text: string): Message => ({ sender: 'bot', text, time: '10:02' });

describe('detectStepFromReply', () => {
  it('maps the markers to steps', () => {
    expect(detectStepFromReply(STEP_2_REPLY)).toBe('STEP_2');
    // STEP_3 is written when the user confirms the institution, never from a reply
    expect(detectStepFromReply('Iată ÎNTREBĂRI_STRATEGICE ...')).toBeNull();
    expect(detectStepFromReply('📊CATEGORIA_A_FINANCIAR: ...')).toBeNull();
    expect(detectStepFromReply('Aspect FINANCIAR')).toBeNull();
    expect(detectStepFromReply('Bună ziua')).toBeNull();
  });
});

describe('useConversationMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  it('shows the (non-persisted) welcome message for a new conversation', () => {
    const { queries } = fakeQueries();
    const router = fakeRouter();
    const { result } = renderHook(() => useConversationMessages({ router, queries }));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ sender: 'bot', text: WELCOME_TEXT });
    expect(result.current.messages[0].id).toBeUndefined();
    expect(result.current.conversationHistory).toEqual([]); // welcome is skipped
    expect(result.current.conversationId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(queries.loadMessages).not.toHaveBeenCalled();
  });

  it('loads an existing conversation and builds the history from it', async () => {
    const existing = [persisted('m1', 'user', 'salut'), persisted('m2', 'bot', 'bună')];
    const { queries } = fakeQueries(existing);
    const router = fakeRouter();
    const { result } = renderHook(() =>
      useConversationMessages({ conversationId: 'conv-1', router, queries }),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queries.loadMessages).toHaveBeenCalledWith('conv-1');
    expect(result.current.messages).toEqual(existing);
    expect(result.current.conversationId).toBe('conv-1');
    expect(result.current.conversationHistory).toEqual([
      { role: 'user', content: 'salut' },
      { role: 'assistant', content: 'bună' },
    ]);
  });

  it('redirects to /chat when loading fails', async () => {
    const { queries } = fakeQueries();
    (queries.loadMessages as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = fakeRouter();
    const { result } = renderHook(() =>
      useConversationMessages({ conversationId: 'conv-x', router, queries }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(router.replace).toHaveBeenCalledWith('/chat');
  });

  it('first turn: creates the conversation, rewrites the URL, saves seq 1 then 2, sets title and step', async () => {
    const { queries, saved, titles, steps } = fakeQueries();
    const router = fakeRouter();
    const { result } = renderHook(() => useConversationMessages({ router, queries }));

    let turn!: Awaited<ReturnType<typeof result.current.startTurn>>;
    await act(async () => {
      turn = await result.current.startTurn(userMsg('Groapă pe strada mea'));
    });

    expect(queries.createConversation).toHaveBeenCalledWith('Groapă pe strada mea');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/chat/conv-new');
    expect(turn).toEqual({ convId: 'conv-new', userSeq: 1, isFirst: true });
    expect(result.current.conversationId).toBe('conv-new');

    act(() => {
      result.current.completeTurn(turn, botMsg(STEP_2_REPLY), 'Groapă pe strada mea');
    });

    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved.map((s) => s.seq)).toEqual([1, 2]);
    expect(saved[0].message.sender).toBe('user');
    expect(saved[1].message.sender).toBe('bot');
    expect(titles).toEqual([{ convId: 'conv-new', title: 'Groapă pe strada mea' }]);
    expect(steps).toEqual([{ convId: 'conv-new', step: 'STEP_2' }]);
    expect(result.current.messages.at(-1)?.text).toBe(STEP_2_REPLY);
  });

  it('later turns: sequence continues after the persisted messages and the title is not touched', async () => {
    const existing = [persisted('m1', 'user', 'a'), persisted('m2', 'bot', 'b')];
    const { queries, saved, titles, steps } = fakeQueries(existing);
    const router = fakeRouter();
    const { result } = renderHook(() =>
      useConversationMessages({ conversationId: 'conv-1', router, queries }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let turn!: Awaited<ReturnType<typeof result.current.startTurn>>;
    await act(async () => {
      turn = await result.current.startTurn(userMsg('și?'));
    });
    expect(queries.createConversation).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(turn).toEqual({ convId: 'conv-1', userSeq: 3, isFirst: false });

    act(() => result.current.completeTurn(turn, botMsg('răspuns simplu'), 'și?'));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved.map((s) => s.seq)).toEqual([3, 4]);
    expect(titles).toEqual([]);
    expect(steps).toEqual([]);
  });

  it('appendMessage / removeErrorMessages / reset', () => {
    const { queries } = fakeQueries();
    const router = fakeRouter();
    const { result } = renderHook(() => useConversationMessages({ router, queries }));

    act(() => result.current.appendMessage({ ...botMsg('x'), isError: true }));
    expect(result.current.messages).toHaveLength(2);
    act(() => result.current.removeErrorMessages());
    expect(result.current.messages).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
  });
});
