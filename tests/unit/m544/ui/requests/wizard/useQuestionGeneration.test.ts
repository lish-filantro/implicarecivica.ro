// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useQuestionGeneration,
  createQuestionsFetcher,
  createSetFetcher,
  FALLBACK_NOTICE,
  SET_ERROR_MESSAGE,
  type FetchQuestions,
  type FetchSet,
  type ProblemContext,
} from '@m544/ui/requests/wizard/useQuestionGeneration';
import type { QuestionSet } from '@m544/shared/types/questions';
import { CATEGORY_IDS, type QuestionCategory } from '@m544/ui/requests/wizard/types';

const CTX = { ce: 'groapă', unde: 'Str. X', cand: 'ieri' };
const FIVE = Object.fromEntries(CATEGORY_IDS.map((c) => [c, ['q1', 'q2', 'q3', 'q4', 'q5']])) as QuestionSet;

/** A fetcher whose per-category promises the test resolves by hand. */
function deferredFetcher() {
  const pending = new Map<QuestionCategory, { resolve: (q: string[]) => void; reject: (e: Error) => void }>();
  const fetchQuestions = vi.fn<FetchQuestions>(
    (category) => new Promise<string[]>((resolve, reject) => pending.set(category, { resolve, reject })),
  );
  return { fetchQuestions, pending };
}

describe('useQuestionGeneration', () => {
  it('does nothing without a problem context', () => {
    const fetchQuestions = vi.fn<FetchQuestions>();
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: 'Prim', fetchQuestions }),
    );
    expect(fetchQuestions).not.toHaveBeenCalled();
    expect(result.current.isAnyLoading).toBe(false);
    expect(result.current.totalGenerated).toBe(0);
  });

  it('fires 5 parallel calls, one per category, with context and institution', () => {
    const { fetchQuestions } = deferredFetcher();
    renderHook(() => useQuestionGeneration({ problemContext: CTX, institutionName: 'Prim', fetchQuestions }));
    expect(fetchQuestions).toHaveBeenCalledTimes(5);
    expect(fetchQuestions.mock.calls.map((c) => c[0])).toEqual(CATEGORY_IDS);
    for (const call of fetchQuestions.mock.calls) {
      expect(call[1]).toEqual(CTX);
      expect(call[2]).toBe('Prim');
    }
  });

  it('tracks loading -> done per category and calls onCategoryReady only with non-empty lists', async () => {
    const { fetchQuestions, pending } = deferredFetcher();
    const onCategoryReady = vi.fn();
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: CTX, institutionName: null, onCategoryReady, fetchQuestions }),
    );

    expect(result.current.isAnyLoading).toBe(true);
    for (const cat of CATEGORY_IDS) expect(result.current.categories[cat].isLoading).toBe(true);

    await act(async () => pending.get('A_FINANCIAR')!.resolve(['a1', 'a2']));
    expect(result.current.categories.A_FINANCIAR).toEqual({ questions: ['a1', 'a2'], isLoading: false, error: null });
    expect(result.current.categories.B_RESPONSABILITATE.isLoading).toBe(true);
    expect(result.current.isAnyLoading).toBe(true);
    expect(onCategoryReady).toHaveBeenCalledWith('A_FINANCIAR', ['a1', 'a2']);

    await act(async () => pending.get('B_RESPONSABILITATE')!.resolve([]));
    expect(result.current.categories.B_RESPONSABILITATE).toEqual({ questions: [], isLoading: false, error: null });
    expect(onCategoryReady).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.get('C_PLANIFICARE')!.resolve(['c1']);
      pending.get('D_MONITORIZARE')!.resolve(['d1']);
      pending.get('E_CONFORMITATE')!.resolve(['e1']);
    });
    await waitFor(() => expect(result.current.isAnyLoading).toBe(false));
    expect(result.current.totalGenerated).toBe(5);
    expect(onCategoryReady).toHaveBeenCalledTimes(4);
  });

  it('records an error per category without affecting the others', async () => {
    const { fetchQuestions, pending } = deferredFetcher();
    const onCategoryReady = vi.fn();
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: CTX, institutionName: null, onCategoryReady, fetchQuestions }),
    );

    await act(async () => pending.get('C_PLANIFICARE')!.reject(new Error('boom')));
    expect(result.current.categories.C_PLANIFICARE).toEqual({ questions: [], isLoading: false, error: 'boom' });
    expect(result.current.categories.A_FINANCIAR.isLoading).toBe(true);
    expect(onCategoryReady).not.toHaveBeenCalled();

    await act(async () => pending.get('A_FINANCIAR')!.resolve(['ok']));
    expect(result.current.categories.A_FINANCIAR.error).toBeNull();
    expect(result.current.totalGenerated).toBe(1);
  });

  it('uses a generic message for non-Error rejections', async () => {
    const fetchQuestions = vi.fn<FetchQuestions>(() => Promise.reject('str'));
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: CTX, institutionName: null, fetchQuestions }),
    );
    await act(async () => {});
    expect(result.current.isAnyLoading).toBe(false);
    expect(result.current.categories.A_FINANCIAR.error).toBe('Eroare necunoscută');
  });

  it('hasStarted guard: generates only once even if the context changes', async () => {
    const fetchQuestions = vi.fn<FetchQuestions>(async () => ['q']);
    const initialProps: { ctx: ProblemContext | null } = { ctx: CTX };
    const { result, rerender } = renderHook(
      (props: { ctx: ProblemContext | null }) =>
        useQuestionGeneration({ problemContext: props.ctx, institutionName: null, fetchQuestions }),
      { initialProps },
    );
    await act(async () => {});
    expect(result.current.isAnyLoading).toBe(false);
    expect(fetchQuestions).toHaveBeenCalledTimes(5);

    rerender({ ctx: { ...CTX, ce: 'altceva' } });
    rerender({ ctx: null });
    rerender({ ctx: CTX });
    expect(fetchQuestions).toHaveBeenCalledTimes(5);
  });

  it('starts late when the context arrives after mount', async () => {
    const fetchQuestions = vi.fn<FetchQuestions>(async () => []);
    const initialProps: { ctx: ProblemContext | null } = { ctx: null };
    const { rerender } = renderHook(
      (props: { ctx: ProblemContext | null }) =>
        useQuestionGeneration({ problemContext: props.ctx, institutionName: null, fetchQuestions }),
      { initialProps },
    );
    expect(fetchQuestions).not.toHaveBeenCalled();
    await act(async () => rerender({ ctx: CTX }));
    expect(fetchQuestions).toHaveBeenCalledTimes(5);
  });
});

describe('createQuestionsFetcher (default loader)', () => {
  it('POSTs to /api/questions/generate and returns data.questions', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ questions: ['x', 'y'] })));
    const load = createQuestionsFetcher(fetchFn as unknown as typeof fetch);
    const out = await load('A_FINANCIAR', CTX, 'Prim');
    expect(out).toEqual(['x', 'y']);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/questions/generate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ category: 'A_FINANCIAR', problemContext: CTX, institutionName: 'Prim' });
  });

  it('returns [] when the body has no questions (e.g. an error payload)', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 }));
    const load = createQuestionsFetcher(fetchFn as unknown as typeof fetch);
    expect(await load('A_FINANCIAR', CTX, null)).toEqual([]);
  });
});

describe('useQuestionGeneration — set mode (chat model)', () => {
  it('a preloaded set fills every category without any fetch', () => {
    const fetchSet = vi.fn<FetchSet>();
    const fetchQuestions = vi.fn<FetchQuestions>();
    const onCategoryReady = vi.fn();
    const { result } = renderHook(() =>
      useQuestionGeneration({
        problemContext: CTX,
        institutionName: 'Prim',
        source: { conversationId: 'c1' },
        preloaded: FIVE,
        fetchSet,
        fetchQuestions,
        onCategoryReady,
      }),
    );
    expect(fetchSet).not.toHaveBeenCalled();
    expect(fetchQuestions).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('preloaded');
    expect(result.current.totalGenerated).toBe(25);
    expect(result.current.isAnyLoading).toBe(false);
    expect(onCategoryReady).toHaveBeenCalledTimes(5);
    expect(onCategoryReady).toHaveBeenCalledWith('A_FINANCIAR', ['q1', 'q2', 'q3', 'q4', 'q5']);
  });

  it('an empty preloaded set is ignored and the set is fetched', async () => {
    const fetchSet = vi.fn<FetchSet>(async () => ({ categories: FIVE, model: 'claude-sonnet-5' }));
    const empty = Object.fromEntries(CATEGORY_IDS.map((c) => [c, []])) as unknown as QuestionSet;
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, source: { conversationId: 'c1' }, preloaded: empty, fetchSet }),
    );
    await waitFor(() => expect(result.current.totalGenerated).toBe(25));
    expect(fetchSet).toHaveBeenCalledTimes(1);
  });

  it('with a source it calls fetchSet once (no cache bypass) and distributes the categories', async () => {
    const fetchSet = vi.fn<FetchSet>(async () => ({ categories: FIVE, model: 'claude-sonnet-5' }));
    const fetchQuestions = vi.fn<FetchQuestions>();
    const onCategoryReady = vi.fn();
    const { result } = renderHook(() =>
      useQuestionGeneration({
        problemContext: CTX,
        institutionName: 'Prim',
        source: { conversationId: 'c1' },
        fetchSet,
        fetchQuestions,
        onCategoryReady,
      }),
    );
    expect(result.current.isAnyLoading).toBe(true);
    expect(result.current.mode).toBe('set');
    await waitFor(() => expect(result.current.isAnyLoading).toBe(false));
    expect(fetchSet).toHaveBeenCalledTimes(1);
    expect(fetchSet).toHaveBeenCalledWith({ conversationId: 'c1' }, false);
    expect(fetchQuestions).not.toHaveBeenCalled();
    expect(result.current.totalGenerated).toBe(25);
    expect(result.current.model).toBe('claude-sonnet-5');
    expect(result.current.setError).toBeNull();
    expect(onCategoryReady).toHaveBeenCalledTimes(5);
  });

  it('a failed set surfaces setError; retry bypasses the cache; a second failure falls back to the per-category generator', async () => {
    const fetchSet = vi.fn<FetchSet>(async () => {
      throw new Error('boom');
    });
    const fetchQuestions = vi.fn<FetchQuestions>(async () => ['legacy']);
    const onCategoryReady = vi.fn();
    const { result } = renderHook(() =>
      useQuestionGeneration({
        problemContext: CTX,
        institutionName: 'Prim',
        source: { conversationId: 'c1' },
        fetchSet,
        fetchQuestions,
        onCategoryReady,
      }),
    );
    await waitFor(() => expect(result.current.setError).toBe('boom'));
    expect(result.current.isAnyLoading).toBe(false);
    expect(result.current.totalGenerated).toBe(0);

    await act(async () => result.current.retry());
    expect(fetchSet).toHaveBeenCalledTimes(2);
    expect(fetchSet.mock.calls[1]).toEqual([{ conversationId: 'c1' }, true]);
    await waitFor(() => expect(result.current.setError).toBe('boom'));
    expect(fetchQuestions).not.toHaveBeenCalled();

    await act(async () => result.current.retry());
    expect(fetchQuestions).toHaveBeenCalledTimes(5);
    expect(fetchQuestions.mock.calls[0][1]).toEqual(CTX);
    await waitFor(() => expect(result.current.totalGenerated).toBe(5));
    expect(result.current.setError).toBeNull();
    expect(result.current.notice).toBe(FALLBACK_NOTICE);
    expect(result.current.mode).toBe('legacy');
    expect(onCategoryReady).toHaveBeenCalledTimes(5);
  });

  it('without a problem context there is no fallback: retry keeps asking for the set', async () => {
    const fetchSet = vi.fn<FetchSet>(async () => {
      throw new Error('');
    });
    const fetchQuestions = vi.fn<FetchQuestions>();
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, source: { sessionId: 's1' }, fetchSet, fetchQuestions }),
    );
    await waitFor(() => expect(result.current.setError).toBe(SET_ERROR_MESSAGE));
    await act(async () => result.current.retry());
    await act(async () => result.current.retry());
    expect(fetchSet).toHaveBeenCalledTimes(3);
    expect(fetchQuestions).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('set');
  });

  it('autoStart: false waits for start(); start() again regenerates bypassing the cache', async () => {
    const fetchSet = vi.fn<FetchSet>(async () => ({ categories: FIVE, model: 'm' }));
    const { result } = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: 'Prim', source: { sessionId: 's1' }, fetchSet, autoStart: false }),
    );
    expect(fetchSet).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('idle');

    await act(async () => result.current.start());
    expect(fetchSet).toHaveBeenCalledWith({ sessionId: 's1' }, false);
    await waitFor(() => expect(result.current.totalGenerated).toBe(25));

    await act(async () => result.current.start());
    expect(fetchSet).toHaveBeenLastCalledWith({ sessionId: 's1' }, true);
    expect(fetchSet).toHaveBeenCalledTimes(2);
  });
});

describe('createSetFetcher (default set loader)', () => {
  it('POSTs the source to /api/questions/generate-set and returns categories + model', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ categories: FIVE, model: 'claude-sonnet-5', cached: true })));
    const load = createSetFetcher(fetchFn as unknown as typeof fetch);
    expect(await load({ conversationId: 'c1' }, false)).toEqual({ categories: FIVE, model: 'claude-sonnet-5', cached: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/questions/generate-set');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ conversationId: 'c1' });
  });

  it('adds ?refresh=1 and throws the API error message on a failed response', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'Limită de rată atinsă.' }), { status: 429 }));
    const load = createSetFetcher(fetchFn as unknown as typeof fetch);
    await expect(load({ sessionId: 's1' }, true)).rejects.toThrow('Limită de rată atinsă.');
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('/api/questions/generate-set?refresh=1');
  });

  it('uses the generic message when the failed response has no body', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 500 }));
    const load = createSetFetcher(fetchFn as unknown as typeof fetch);
    await expect(load({ sessionId: 's1' }, false)).rejects.toThrow(SET_ERROR_MESSAGE);
  });
});
