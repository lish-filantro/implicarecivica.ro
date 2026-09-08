// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRateLimitCheck } from '@m544/ui/requests/preview/useRateLimitCheck';

const info = { sent_today: 2, remaining: 8, limit: 10 };

describe('useRateLimitCheck', () => {
  it('starts loading, then exposes the limit', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(info))) as unknown as typeof fetch;
    const { result } = renderHook(() => useRateLimitCheck({ email: 'a@b.ro' }, fetchFn));
    expect(result.current.rateLimitLoading).toBe(true);
    expect(result.current.rateLimit).toBeNull();

    await act(async () => {});
    expect(result.current.rateLimitLoading).toBe(false);
    expect(result.current.rateLimit).toEqual(info);
    expect(fetchFn).toHaveBeenCalledWith('/api/rate-limit/check?email=a%40b.ro');
  });

  it('uses the institution name when there is no email', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(info))) as unknown as typeof fetch;
    renderHook(() => useRateLimitCheck({ email: '', name: 'Prim' }, fetchFn));
    await act(async () => {});
    expect(fetchFn).toHaveBeenCalledWith('/api/rate-limit/check?name=Prim');
  });

  it('skips the check (not loading, no fetch) when there is nothing to key on', () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const { result } = renderHook(() => useRateLimitCheck({ email: '', name: '' }, fetchFn));
    expect(result.current.rateLimitLoading).toBe(false);
    expect(result.current.rateLimit).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('leaves rateLimit null on failure but stops loading (sending stays allowed)', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    const { result } = renderHook(() => useRateLimitCheck({ email: 'a@b.ro' }, fetchFn));
    await act(async () => {});
    expect(result.current.rateLimitLoading).toBe(false);
    expect(result.current.rateLimit).toBeNull();
  });
});
