'use client';

import { useRouter } from 'next/navigation';
import { useAdminStats } from '@m544/ui/admin/useAdminStats';
import { AdminKpiCard } from '@m544/ui/admin/AdminKpiCard';
import { ActivityRow } from '@m544/ui/admin/ActivityRow';
import { PendingUsersTable } from '@m544/ui/admin/PendingUsersTable';
import { SignupsChart } from '@m544/ui/admin/SignupsChart';
import { StatusDistribution } from '@m544/ui/admin/StatusDistribution';
import { TopInstitutions } from '@m544/ui/admin/TopInstitutions';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { stats, pendingUsers, loading, error, removePendingUser } = useAdminStats({
    onUnauthorized: () => router.push('/login?redirectedFrom=/admin/dashboard'),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-red-600 dark:text-red-400">{error || 'Eroare necunoscută'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitorizare platformă — doar date agregate, fără informații personale
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <AdminKpiCard
            title="Total conturi"
            value={stats.users.total}
            color="sky"
          />
          <AdminKpiCard
            title="Conturi noi (7 zile)"
            value={stats.users.new_7d}
            color="emerald"
          />
          <AdminKpiCard
            title="Conturi noi (30 zile)"
            value={stats.users.new_30d}
            color="indigo"
          />
          <AdminKpiCard
            title="Utilizatori activi (30 zile)"
            value={stats.users.active_30d}
            color="amber"
          />
          <AdminKpiCard
            title="În așteptare aprobare"
            value={stats.users.pending_approval}
            color="rose"
          />
        </div>

        {/* Pending Accounts */}
        <PendingUsersTable users={pendingUsers} onRemoved={removePendingUser} />

        {/* Daily Signups Chart */}
        <SignupsChart dailySignups={stats.dailySignups} />

        {/* Activity + Status Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Activity Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Activitate (30 zile)
            </h2>
            <div className="space-y-3">
              <ActivityRow label="Cereri create" value={stats.activity.requests_30d} />
              <ActivityRow label="Sesiuni create" value={stats.activity.sessions_30d} />
              <ActivityRow label="Mesaje chat" value={stats.activity.messages_30d} />
              <ActivityRow label="Feedback-uri" value={stats.activity.feedback_30d} />
              <ActivityRow label="Campanii active" value={stats.activity.campaigns_active} />
            </div>
          </div>

          {/* Request Status Distribution */}
          <StatusDistribution
            title="Distribuție cereri"
            distribution={stats.requestStatus}
            emptyLabel="Nicio cerere"
          />

          {/* Feedback Status Distribution */}
          <StatusDistribution
            title="Distribuție feedback"
            distribution={stats.feedbackStatus}
            emptyLabel="Niciun feedback"
          />
        </div>

        {/* Top Institutions */}
        <TopInstitutions institutions={stats.topInstitutions} />
      </div>
    </div>
  );
}
