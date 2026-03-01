'use client';

import { useState, useEffect, useMemo } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { SessionCard } from '@/components/dashboard/SessionCard';
import { SessionDetailModal } from '@/components/dashboard/SessionDetailModal';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { listSessionsWithRequests } from '@/lib/supabase/session-queries';
import { getUnreadCount } from '@/lib/supabase/email-queries';
import { getProfile } from '@/lib/supabase/profile-queries';
import type { DashboardStats } from '@/lib/types/request';
import type { RequestSessionWithRequests, SessionStatus } from '@/lib/types/session';
import {
  getEffectiveDeadline,
  getDaysUntilDeadline,
  getDaysSinceSent,
  isCriticalRequest,
} from '@/lib/utils/requestUtils';
import { computeSessionStats } from '@/lib/utils/sessionUtils';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<RequestSessionWithRequests[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [detailSession, setDetailSession] = useState<RequestSessionWithRequests | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [sessionsData, profile, unread] = await Promise.all([
          listSessionsWithRequests(),
          getProfile(),
          getUnreadCount(),
        ]);
        setSessions(sessionsData);
        setUserName(
          profile?.display_name
          || profile?.first_name
          || ''
        );
        setUnreadCount(unread);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError('Nu am putut încărca datele.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // All requests flattened from sessions (for KPI stats)
  const allRequests = useMemo(() => {
    return sessions.flatMap((s) => s.requests);
  }, [sessions]);

  // Session stats
  const sessionStats = useMemo(() => computeSessionStats(sessions), [sessions]);

  // Calculate request-level statistics (for KPI cards)
  const requestStats = useMemo<DashboardStats>(() => {
    const stats: DashboardStats = {
      total: allRequests.length,
      this_month: 0,
      registered: 0,
      waiting: 0,
      by_status: {
        pending: 0,
        received: 0,
        extension: 0,
        answered: 0,
        delayed: 0,
      },
    };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    allRequests.forEach((request) => {
      let status = request.status;

      const effectiveDeadline = getEffectiveDeadline(request);
      const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline) : null;

      if (status !== 'answered' && daysLeft !== null && daysLeft < 0) {
        status = 'delayed';
      }

      if (status === 'delayed') {
        stats.by_status.delayed += 1;
      } else if (status === 'pending') {
        if (request.registration_number) {
          stats.registered += 1;
        } else {
          stats.by_status.pending += 1;
        }
      } else if (status === 'received') {
        stats.registered += 1;
        stats.by_status.received += 1;
      } else {
        stats.by_status[status] += 1;
      }

      const daysSinceSent = getDaysSinceSent(request);
      if (!request.registration_number && daysSinceSent >= 3) {
        stats.waiting += 1;
      }

      const initiated = request.date_initiated ? new Date(request.date_initiated) : null;
      if (initiated && initiated >= monthStart) {
        stats.this_month += 1;
      }
    });

    return stats;
  }, [allRequests]);

  // Calculate alerts
  const criticalRequests = useMemo(() => {
    return allRequests.filter(isCriticalRequest).sort((a, b) => {
      const daysA = getDaysUntilDeadline(getEffectiveDeadline(a));
      const daysB = getDaysUntilDeadline(getEffectiveDeadline(b));
      return (daysA ?? Infinity) - (daysB ?? Infinity);
    });
  }, [allRequests]);

  const awaitingRegistration = useMemo(() => {
    return allRequests.filter((request) => {
      if (request.registration_number) return false;
      const daysSinceSent = getDaysSinceSent(request);
      return daysSinceSent >= 3;
    });
  }, [allRequests]);

  // KPI Cards configuration
  const statCards = useMemo(() => {
    const criticalCount = criticalRequests.length;

    return [
      {
        id: 'total',
        title: 'Total cereri',
        value: requestStats.total,
        subtitle: `Luna aceasta: ${requestStats.this_month}`,
        iconWrapperLight: 'border-sky-200 bg-sky-50 text-sky-700',
        iconWrapperDark: 'dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200',
        valueGradientLight: 'from-sky-500 via-sky-600 to-blue-700',
        valueGradientDark: 'dark:from-sky-200 dark:via-sky-300 dark:to-sky-500',
        backgroundLight: 'from-sky-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-sky-500/15 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        id: 'pending',
        title: 'Așteptare înregistrare',
        value: requestStats.by_status.pending,
        subtitle: 'În așteptarea unui număr de înregistrare',
        iconWrapperLight: 'border-amber-200 bg-amber-50 text-amber-700',
        iconWrapperDark: 'dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
        valueGradientLight: 'from-amber-500 via-orange-500 to-orange-600',
        valueGradientDark: 'dark:from-amber-200 dark:via-amber-300 dark:to-orange-500',
        backgroundLight: 'from-amber-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-amber-500/10 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        id: 'registered',
        title: 'Înregistrate',
        value: requestStats.registered,
        subtitle: 'Înregistrate și în așteptarea răspunsului',
        iconWrapperLight: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        iconWrapperDark: 'dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200',
        valueGradientLight: 'from-indigo-500 via-indigo-600 to-blue-700',
        valueGradientDark: 'dark:from-blue-200 dark:via-blue-300 dark:to-indigo-500',
        backgroundLight: 'from-indigo-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-blue-500/10 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        id: 'answered',
        title: 'Răspunse',
        value: requestStats.by_status.answered,
        subtitle: 'Finalizate cu succes',
        iconWrapperLight: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        iconWrapperDark: 'dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
        valueGradientLight: 'from-emerald-500 via-emerald-600 to-emerald-700',
        valueGradientDark: 'dark:from-emerald-200 dark:via-emerald-300 dark:to-emerald-500',
        backgroundLight: 'from-emerald-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-emerald-500/10 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        id: 'extension',
        title: 'Prelungite',
        value: requestStats.by_status.extension,
        subtitle: 'Cereri cu termen extins',
        iconWrapperLight: 'border-purple-200 bg-purple-50 text-purple-700',
        iconWrapperDark: 'dark:border-purple-400/40 dark:bg-purple-500/10 dark:text-purple-200',
        valueGradientLight: 'from-purple-500 via-purple-600 to-violet-700',
        valueGradientDark: 'dark:from-purple-200 dark:via-purple-300 dark:to-violet-500',
        backgroundLight: 'from-purple-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-purple-500/10 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        id: 'delayed',
        title: 'Întârziate',
        value: requestStats.by_status.delayed,
        subtitle:
          criticalCount > 0
            ? `${criticalCount} termene în următoarele 3 zile`
            : 'Termene depășite fără răspuns',
        iconWrapperLight: 'border-rose-200 bg-rose-50 text-rose-700',
        iconWrapperDark: 'dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200',
        valueGradientLight: 'from-rose-500 via-rose-600 to-rose-700',
        valueGradientDark: 'dark:from-rose-200 dark:via-rose-300 dark:to-rose-500',
        backgroundLight: 'from-rose-500/10 via-white/0 to-transparent',
        backgroundDark: 'dark:from-rose-500/10 dark:via-transparent dark:to-transparent',
        icon: (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 5a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z" />
          </svg>
        ),
      },
    ];
  }, [requestStats, criticalRequests.length]);

  // Alerts
  const alerts = useMemo(() => {
    const list = [];
    if (criticalRequests.length) {
      list.push({
        type: 'critical' as const,
        message: `${criticalRequests.length} cereri cu termen în următoarele 3 zile`,
      });
    }
    if (awaitingRegistration.length) {
      list.push({
        type: 'warning' as const,
        message: `${awaitingRegistration.length} cereri trimise fără număr de înregistrare`,
      });
    }
    return list;
  }, [criticalRequests, awaitingRegistration]);

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? sessions
      : sessions.filter((s) => s.cached_status === statusFilter);

    return [...filtered].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [sessions, statusFilter]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center min-h-[60vh] flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader
          userName={userName}
          unreadNotifications={unreadCount}
        />

        {/* Enhanced Alerts with Modern Design */}
        {alerts.length > 0 && (
          <div className="mb-8 space-y-3" role="alert" aria-live="polite">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`group relative overflow-hidden p-4 rounded-xl border
                           backdrop-blur-sm transition-all duration-300
                           hover:shadow-lg hover:-translate-y-0.5
                           animate-slide-in
                           ${
                  alert.type === 'critical'
                    ? 'bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-900/20 dark:to-red-900/5 border-red-200 dark:border-red-800'
                    : alert.type === 'warning'
                      ? 'bg-gradient-to-r from-orange-50 to-orange-50/50 dark:from-orange-900/20 dark:to-orange-900/5 border-orange-200 dark:border-orange-800'
                      : 'bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-900/20 dark:to-blue-900/5 border-blue-200 dark:border-blue-800'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Accent bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    alert.type === 'critical'
                      ? 'bg-red-500'
                      : alert.type === 'warning'
                        ? 'bg-orange-500'
                        : 'bg-blue-500'
                  }`}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-3 ml-3">
                  {/* Icon with pulse animation for critical */}
                  <div
                    className={`flex-shrink-0 ${
                      alert.type === 'critical' ? 'animate-pulse' : ''
                    }`}
                  >
                    <svg
                      className={`h-5 w-5 ${
                        alert.type === 'critical'
                          ? 'text-red-600 dark:text-red-400'
                          : alert.type === 'warning'
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-blue-600 dark:text-blue-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>

                  <p
                    className={`font-medium flex-1 ${
                      alert.type === 'critical'
                        ? 'text-red-800 dark:text-red-300'
                        : alert.type === 'warning'
                          ? 'text-orange-800 dark:text-orange-300'
                          : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>

                {/* Hover glow effect */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100
                             transition-opacity duration-300 pointer-events-none
                             bg-gradient-to-r from-white/20 to-transparent dark:from-white/5"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        )}

        {/* KPI Cards with Progressive Loading Animation */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 mb-10">
          {statCards.map((card, index) => (
            <div
              key={card.id}
              className="animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <KPICard {...card} />
            </div>
          ))}
        </div>

        {/* Sessions List */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sesiunile tale de cereri
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {sessionStats.total_sessions} sesiuni · {sessionStats.total_requests} cereri trimise în baza Legii 544/2001
              </p>
            </div>

            {/* Status filters */}
            {sessions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { key: 'all' as const, label: 'Toate', count: sessions.length },
                  { key: 'pending' as const, label: 'În așteptare', count: sessionStats.by_status.pending },
                  { key: 'in_progress' as const, label: 'În curs', count: sessionStats.by_status.in_progress },
                  { key: 'partial_answered' as const, label: 'Parțial', count: sessionStats.by_status.partial_answered },
                  { key: 'completed' as const, label: 'Finalizate', count: sessionStats.by_status.completed },
                  { key: 'overdue' as const, label: 'Întârziate', count: sessionStats.by_status.overdue },
                ] as const).filter((f) => f.key === 'all' || f.count > 0).map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setStatusFilter(filter.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg
                             border transition-colors duration-200
                             focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                             ${statusFilter === filter.key
                               ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                               : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                             }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredSessions.length > 0 ? (
            <div className="space-y-4">
              {filteredSessions.map((session, index) => (
                <div
                  key={session.id}
                  className="animate-slide-in"
                  style={{ animationDelay: `${(index + 6) * 50}ms` }}
                >
                  <SessionCard session={session} onOpenDetail={setDetailSession} />
                </div>
              ))}
            </div>
          ) : (
            <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                          p-12 text-center transition-all duration-300
                          hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600">
              <div className="animate-scale-in">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600
                           transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  {statusFilter === 'all' ? 'Nu există cereri încă' : 'Nu există sesiuni cu acest status'}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  {statusFilter === 'all'
                    ? 'Creează prima cerere din chatbot pentru a începe procesul de solicitare a informațiilor publice'
                    : 'Încearcă un alt filtru pentru a vedea sesiunile tale'
                  }
                </p>
                {statusFilter === 'all' && (
                  <button
                    className="mt-6 px-6 py-2.5 bg-activist-orange-500 hover:bg-activist-orange-600
                             text-white font-bold uppercase tracking-wide
                             rounded-lg transition-all duration-200
                             hover:shadow-lg hover:scale-105
                             focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                             active:scale-95"
                    onClick={() => {/* Navigate to chatbot */}}
                  >
                    Creează Cerere
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Session Detail Modal */}
        {detailSession && (
          <SessionDetailModal
            session={detailSession}
            onClose={() => setDetailSession(null)}
          />
        )}
    </div>
  );
}
