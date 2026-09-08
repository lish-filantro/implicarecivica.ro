// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReview, fetchReviewPost, REVIEW_ERROR, type ReviewPost } from '@m544/ui/emails/review/useReview';
import { makeEmail } from '../_fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('useReview', () => {
  it('assign / reclassify / dismiss post the right bodies and report the returned email', async () => {
    const returned = makeEmail({ id: 'e1', needs_review: false });
    const post = vi.fn<ReviewPost>(async () => returned);
    const onUpdated = vi.fn();
    const { result } = renderHook(() => useReview({ post, onUpdated }));

    let out: unknown;
    await act(async () => {
      out = await result.current.assign('e1', 'r1');
    });
    expect(out).toBe(returned);
    expect(post).toHaveBeenLastCalledWith('e1', { action: 'assign', request_id: 'r1' });

    await act(async () => {
      await result.current.reclassify('e1', 'amanate', '  nota  ');
    });
    expect(post).toHaveBeenLastCalledWith('e1', { action: 'reclassify', category: 'amanate', note: 'nota' });

    await act(async () => {
      await result.current.reclassify('e1', 'irelevant', '   ');
    });
    expect(post).toHaveBeenLastCalledWith('e1', { action: 'reclassify', category: 'irelevant' });

    await act(async () => {
      await result.current.dismiss('e1');
    });
    expect(post).toHaveBeenLastCalledWith('e1', { action: 'dismiss' });

    expect(onUpdated).toHaveBeenCalledTimes(4);
    expect(onUpdated).toHaveBeenLastCalledWith(returned);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and resolves null when the transport fails; the next call clears it', async () => {
    const post = vi
      .fn<ReviewPost>()
      .mockRejectedValueOnce(new Error('Cererea nu a fost găsită'))
      .mockRejectedValueOnce('weird')
      .mockResolvedValueOnce(makeEmail());
    const onUpdated = vi.fn();
    const { result } = renderHook(() => useReview({ post, onUpdated }));

    await act(async () => {
      expect(await result.current.assign('e1', 'r1')).toBeNull();
    });
    expect(result.current.error).toBe('Cererea nu a fost găsită');
    await act(async () => {
      await result.current.dismiss('e1');
    });
    expect(result.current.error).toBe(REVIEW_ERROR);
    expect(onUpdated).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.dismiss('e1');
    });
    expect(result.current.error).toBeNull();
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it('fetchReviewPost hits /api/emails/{id}/review and unwraps the email or the error', async () => {
    const email = makeEmail({ id: 'e1' });
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, email }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchReviewPost('e1', { action: 'dismiss' })).toEqual(email);
    expect(fetchMock).toHaveBeenCalledWith('/api/emails/e1/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    });

    vi.stubGlobal('fetch', async () => ({ ok: false, json: async () => ({ error: 'Emailul nu a fost găsit' }) }));
    await expect(fetchReviewPost('e1', { action: 'dismiss' })).rejects.toThrow('Emailul nu a fost găsit');

    vi.stubGlobal('fetch', async () => ({ ok: false, json: async () => { throw new Error('not json'); } }));
    await expect(fetchReviewPost('e1', { action: 'dismiss' })).rejects.toThrow(REVIEW_ERROR);
  });
});
