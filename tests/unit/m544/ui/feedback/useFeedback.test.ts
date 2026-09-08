// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeedback, type FeedbackDeps } from '@m544/ui/feedback/useFeedback';
import type { Feedback, CreateFeedbackPayload } from '@m544/shared/types/feedback';

const existing: Feedback = {
  id: 'f0',
  user_id: 'u1',
  category: 'bug',
  message: 'Nu merge',
  page_url: '/feedback',
  status: 'nou',
  created_at: '2026-09-01T00:00:00Z',
};

function deps(overrides: Partial<FeedbackDeps> = {}): FeedbackDeps {
  return {
    listMyFeedback: vi.fn(async () => [existing]),
    createFeedback: vi.fn(
      async (p: CreateFeedbackPayload): Promise<Feedback> => ({
        id: 'f1',
        user_id: 'u1',
        category: p.category,
        message: p.message,
        page_url: p.page_url ?? null,
        status: 'nou',
        created_at: '2026-09-08T00:00:00Z',
      }),
    ),
    ...overrides,
  };
}

describe('useFeedback', () => {
  it('loads the history', async () => {
    const { result } = renderHook(() => useFeedback(deps()));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.feedback).toEqual([existing]);
  });

  it('submit is a no-op without category or message', async () => {
    const d = deps();
    const { result } = renderHook(() => useFeedback(d));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setMessage('   '));
    await act(() => result.current.submit());
    expect(d.createFeedback).not.toHaveBeenCalled();
  });

  it('submit creates the feedback, prepends it and resets the form', async () => {
    const d = deps();
    const { result } = renderHook(() => useFeedback(d));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setCategory('sugestie');
      result.current.setMessage('  Ar fi util un export.  ');
    });
    await act(() => result.current.submit());

    expect(d.createFeedback).toHaveBeenCalledWith({
      category: 'sugestie',
      message: 'Ar fi util un export.',
      page_url: '/feedback',
    });
    expect(result.current.feedback.map((f) => f.id)).toEqual(['f1', 'f0']);
    expect(result.current.category).toBeNull();
    expect(result.current.message).toBe('');
    expect(result.current.success).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('submit shows an error when creation fails', async () => {
    const d = deps({ createFeedback: vi.fn(async () => { throw new Error('rls'); }) });
    const { result } = renderHook(() => useFeedback(d));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setCategory('bug');
      result.current.setMessage('x');
    });
    await act(() => result.current.submit());
    expect(result.current.error).toBe('Nu s-a putut trimite feedbackul. Încearcă din nou.');
    expect(result.current.feedback).toEqual([existing]);
    expect(result.current.submitting).toBe(false);
  });
});
