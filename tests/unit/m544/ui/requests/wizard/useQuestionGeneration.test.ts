// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useQuestionGeneration,
  createQuestionsFetcher,
  type FetchQuestions,
  type ProblemContext,
} from '@m544/ui/requests/wizard/useQuestionGeneration';
import { CATEGORY_IDS, type QuestionCategory } from '@m544/ui/requests/wizard/types';

const CTX = { ce: 'groapă', unde: 'Str. X', cand: 'ieri' };

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
