'use client';

/**
 * Loads everything the dashboard page needs in one round: sessions with their
 * requests, the profile (for the greeting) and the unread-email count.
 * Loaders are injectable so tests run without Supabase.
 */
import { useState, useEffect } from 'react';
import { listSessionsWithRequests } from '@m544/requests/sessions/queries.client';
import { getUnreadCount } from '@m544/emails/queries.client';
import { getProfile } from '@m544/emails/profile-queries.client';
import type { Profile } from '@m544/shared/types/profile';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';

export interface DashboardLoaders {
  loadSessions: () => Promise<RequestSessionWithRequests[]>;
  loadProfile: () => Promise<Profile | null>;
  loadUnreadCount: () => Promise<number>;
}

export interface DashboardData {
  sessions: RequestSessionWithRequests[];
  loading: boolean;
  error: string | null;
  userName: string;
  unreadCount: number;
}

const defaultLoaders: DashboardLoaders = {
  loadSessions: () => listSessionsWithRequests(),
  loadProfile: () => getProfile(),
  loadUnreadCount: () => getUnreadCount(),
};

export function useDashboardData(loaders: Partial<DashboardLoaders> = {}): DashboardData {
  const { loadSessions, loadProfile, loadUnreadCount } = { ...defaultLoaders, ...loaders };
  const [sessions, setSessions] = useState<RequestSessionWithRequests[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sessionsData, profile, unread] = await Promise.all([
          loadSessions(),
          loadProfile(),
          loadUnreadCount(),
        ]);
        if (cancelled) return;
        setSessions(sessionsData);
        setUserName(
          profile?.display_name
          || profile?.first_name
          || ''
        );
        setUnreadCount(unread);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        if (!cancelled) setError('Nu am putut încărca datele.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Loaders are captured once, on mount (same as the original page effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sessions, loading, error, userName, unreadCount };
}
