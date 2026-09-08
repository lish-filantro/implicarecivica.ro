// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '@m544/ui/dashboard/useDashboardData';
import type { Profile } from '@m544/shared/types/profile';
import { makeSession } from './_fixtures';

const profile = {
  id: 'user-1',
  first_name: 'Ana',
  last_name: 'Pop',
  display_name: null,
} as unknown as Profile;

describe('useDashboardData', () => {
  it('starts loading, then exposes sessions, name and unread count', async () => {
    const sessions = [makeSession({ id: 's1' })];
    const { result } = renderHook(() =>
      useDashboardData({
        loadSessions: async () => sessions,
        loadProfile: async () => profile,
        loadUnreadCount: async () => 4,
      }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.sessions).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(result.current.userName).toBe('Ana');
    expect(result.current.unreadCount).toBe(4);
  });

  it('prefers display_name and falls back to empty string without a profile', async () => {
    const named = renderHook(() =>
      useDashboardData({
        loadSessions: async () => [],
        loadProfile: async () => ({ ...profile, display_name: 'Ana P.' }),
        loadUnreadCount: async () => 0,
      }),
    );
    await waitFor(() => expect(named.result.current.loading).toBe(false));
    expect(named.result.current.userName).toBe('Ana P.');

    const anonymous = renderHook(() =>
      useDashboardData({
        loadSessions: async () => [],
        loadProfile: async () => null,
        loadUnreadCount: async () => 0,
      }),
    );
    await waitFor(() => expect(anonymous.result.current.loading).toBe(false));
    expect(anonymous.result.current.userName).toBe('');
  });

  it('reports a user-facing error when any loader fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useDashboardData({
        loadSessions: async () => {
          throw new Error('boom');
        },
        loadProfile: async () => profile,
        loadUnreadCount: async () => 0,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Nu am putut încărca datele.');
    expect(result.current.sessions).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
