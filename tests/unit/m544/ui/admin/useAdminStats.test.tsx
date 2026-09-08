// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminStats, FORBIDDEN_MESSAGE, LOAD_ERROR_MESSAGE } from '@m544/ui/admin/useAdminStats';
import { fakeFetch, jsonResponse, pendingFixture, statsFixture } from './_fixtures';

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('useAdminStats', () => {
  it('loads stats then pending users', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/admin/stats': () => jsonResponse(200, statsFixture),
      '/api/admin/users/pending': () => jsonResponse(200, { users: pendingFixture }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.stats?.users.total).toBe(1234);
    expect(result.current.pendingUsers.map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/stats', '/api/admin/users/pending']);
  });

  it('removes a pending user locally', async () => {
    const { fetchFn } = fakeFetch({
      '/api/admin/stats': () => jsonResponse(200, statsFixture),
      '/api/admin/users/pending': () => jsonResponse(200, { users: pendingFixture }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.removePendingUser('u1'));
    expect(result.current.pendingUsers.map((u) => u.id)).toEqual(['u2']);
  });

  it('keeps the stats when the pending-users call fails', async () => {
    const { fetchFn } = fakeFetch({
      '/api/admin/stats': () => jsonResponse(200, statsFixture),
      '/api/admin/users/pending': () => jsonResponse(500, { error: 'db down' }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats).not.toBeNull();
    expect(result.current.pendingUsers).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('calls onUnauthorized on 401 without setting an error', async () => {
    const onUnauthorized = vi.fn();
    const { fetchFn, calls } = fakeFetch({
      '/api/admin/stats': () => jsonResponse(401, { error: 'Neautorizat' }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn, onUnauthorized }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.stats).toBeNull();
    expect(calls).toHaveLength(1); // pending users never requested
  });

  it('shows the API message on 403 instead of redirecting', async () => {
    const onUnauthorized = vi.fn();
    const { fetchFn } = fakeFetch({
      '/api/admin/stats': () => jsonResponse(403, { error: 'Acces interzis' }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn, onUnauthorized }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Acces interzis');
  });

  it('falls back to a default message on a 403 without a JSON body', async () => {
    const { fetchFn } = fakeFetch({
      '/api/admin/stats': () => new Response('forbidden', { status: 403 }),
    });
    const { result } = renderHook(() => useAdminStats({ fetchFn }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(FORBIDDEN_MESSAGE);
  });

  it('reports a generic error on 500 and on network failures', async () => {
    const server = fakeFetch({ '/api/admin/stats': () => jsonResponse(500, { error: 'boom' }) });
    const a = renderHook(() => useAdminStats({ fetchFn: server.fetchFn }));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(a.result.current.error).toBe(LOAD_ERROR_MESSAGE);

    const b = renderHook(() =>
      useAdminStats({
        fetchFn: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    );
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(b.result.current.error).toBe(LOAD_ERROR_MESSAGE);
  });
});
