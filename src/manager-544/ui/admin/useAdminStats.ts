'use client';

/**
 * Loads the aggregate stats and the pending-approval accounts for the admin
 * dashboard. 401 (no session) → `onUnauthorized` (the page redirects to login);
 * 403 (logged in, not an admin) → the API's error message is shown.
 */
import { useState, useEffect } from 'react';
import { defaultFetch, type FetchLike, type PendingUser, type StatsData } from './types';

export interface AdminStatsOptions {
  fetchFn?: FetchLike;
  onUnauthorized?: () => void;
}

export interface AdminStatsState {
  stats: StatsData | null;
  pendingUsers: PendingUser[];
  loading: boolean;
  error: string | null;
  /** Drop a user from the pending list (after approve/reject succeeded). */
  removePendingUser: (userId: string) => void;
}

export const FORBIDDEN_MESSAGE = 'Nu ai drepturi de administrator.';
export const LOAD_ERROR_MESSAGE = 'Nu am putut încărca statisticile.';

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  } catch {
    // non-JSON body
  }
  return null;
}

export function useAdminStats({ fetchFn = defaultFetch, onUnauthorized }: AdminStatsOptions = {}): AdminStatsState {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingUsers() {
      try {
        const res = await fetchFn('/api/admin/users/pending');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPendingUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to load pending users:', err);
      }
    }

    async function load() {
      try {
        const res = await fetchFn('/api/admin/stats');
        if (cancelled) return;
        if (res.status === 401) {
          onUnauthorized?.();
          return;
        }
        if (res.status === 403) {
          setError((await readErrorMessage(res)) || FORBIDDEN_MESSAGE);
          return;
        }
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        if (cancelled) return;
        setStats(data);
        await loadPendingUsers();
      } catch (err) {
        console.error('Admin stats error:', err);
        if (!cancelled) setError(LOAD_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Dependencies are captured once, on mount (same as the original page effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removePendingUser = (userId: string) =>
    setPendingUsers((prev) => prev.filter((u) => u.id !== userId));

  return { stats, pendingUsers, loading, error, removePendingUser };
}
