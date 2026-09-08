'use client';

import { useState, useMemo } from 'react';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import { computeSessionStats } from '@m544/requests/utils/session-stats';
import { useDashboardData } from '@m544/ui/dashboard/useDashboardData';
import {
  computeRequestStats,
  computeAlerts,
  getCriticalRequests,
  filterSessions,
  type SessionFilter,
} from '@m544/ui/dashboard/stats';
import { DashboardHeader } from '@m544/ui/dashboard/DashboardHeader';
import { DashboardAlerts } from '@m544/ui/dashboard/DashboardAlerts';
import { KpiGrid } from '@m544/ui/dashboard/KpiGrid';
import { SessionList } from '@m544/ui/dashboard/SessionList';
import { SessionDetailModal } from '@m544/ui/dashboard/SessionDetailModal';

export default function DashboardPage() {
  const { sessions, loading, error, userName, unreadCount } = useDashboardData();
  const [statusFilter, setStatusFilter] = useState<SessionFilter>('all');
  const [detailSession, setDetailSession] = useState<RequestSessionWithRequests | null>(null);

  // All requests flattened from sessions (for KPI stats)
  const allRequests = useMemo(() => sessions.flatMap((s) => s.requests), [sessions]);

  const sessionStats = useMemo(() => computeSessionStats(sessions), [sessions]);
  const requestStats = useMemo(() => computeRequestStats(allRequests), [allRequests]);
  const criticalCount = useMemo(() => getCriticalRequests(allRequests).length, [allRequests]);
  const alerts = useMemo(() => computeAlerts(allRequests), [allRequests]);
  const filteredSessions = useMemo(
    () => filterSessions(sessions, statusFilter),
    [sessions, statusFilter],
  );

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

        <DashboardAlerts alerts={alerts} />

        <KpiGrid requestStats={requestStats} criticalCount={criticalCount} />

        <SessionList
          sessions={sessions}
          filteredSessions={filteredSessions}
          sessionStats={sessionStats}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          onOpenDetail={setDetailSession}
        />

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
