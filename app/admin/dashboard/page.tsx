'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StatsData {
  users: {
    total: number;
    new_7d: number;
    new_30d: number;
    active_30d: number;
    pending_approval: number;
  };
  dailySignups: { day: string; count: number }[];
  activity: {
    requests_30d: number;
    sessions_30d: number;
    messages_30d: number;
    feedback_30d: number;
    campaigns_active: number;
  };
  requestStatus: Record<string, number>;
  feedbackStatus: Record<string, number>;
  topInstitutions: { name: string; total: number; answered: number }[];
}

interface PendingUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'În așteptare',
  received: 'Primite',
  answered: 'Răspunse',
  extension: 'Prelungite',
  delayed: 'Întârziate',
  nou: 'Noi',
  in_lucru: 'În lucru',
  rezolvat: 'Rezolvate',
  respins: 'Respinse',
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const loadPendingUsers = async () => {
    try {
      const res = await fetch('/api/admin/users/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load pending users:', err);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.status === 401) {
          router.push('/login?redirectedFrom=/admin/dashboard');
          return;
        }
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        setStats(data);
        await loadPendingUsers();
      } catch (err) {
        console.error('Admin stats error:', err);
        setError('Nu am putut încărca statisticile.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest cont? Acțiunea este ireversibilă.')) return;
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setActionLoading(null);
    }
  };

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

  const maxSignup = Math.max(...stats.dailySignups.map((d) => d.count), 1);

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
          <KPICard
            title="Total conturi"
            value={stats.users.total}
            color="sky"
          />
          <KPICard
            title="Conturi noi (7 zile)"
            value={stats.users.new_7d}
            color="emerald"
          />
          <KPICard
            title="Conturi noi (30 zile)"
            value={stats.users.new_30d}
            color="indigo"
          />
          <KPICard
            title="Utilizatori activi (30 zile)"
            value={stats.users.active_30d}
            color="amber"
          />
          <KPICard
            title="În așteptare aprobare"
            value={stats.users.pending_approval}
            color="rose"
          />
        </div>

        {/* Pending Accounts */}
        {pendingUsers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Conturi în așteptarea aprobării ({pendingUsers.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Nume</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Data înregistrării</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <td className="py-3 pr-4 text-gray-900 dark:text-gray-100 font-medium">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                          : user.display_name || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                        {user.email || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('ro-RO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === user.id ? '...' : 'Aprobă'}
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                          >
                            Respinge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Signups Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Conturi noi pe zi (ultimele 30 zile)
          </h2>
          <div className="flex items-end gap-[2px] h-32">
            {stats.dailySignups.map((d) => (
              <div
                key={d.day}
                className="flex-1 group relative"
              >
                <div
                  className="w-full bg-sky-500 dark:bg-sky-400 rounded-t transition-all hover:bg-sky-600 dark:hover:bg-sky-300"
                  style={{
                    height: `${Math.max((d.count / maxSignup) * 100, d.count > 0 ? 4 : 0)}%`,
                    minHeight: d.count > 0 ? '2px' : '0px',
                  }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap">
                    {d.day.slice(5)}: {d.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{stats.dailySignups[0]?.day.slice(5)}</span>
            <span>{stats.dailySignups[stats.dailySignups.length - 1]?.day.slice(5)}</span>
          </div>
        </div>

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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Distribuție cereri
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.requestStatus).map(([status, count]) => (
                <StatusRow
                  key={status}
                  label={STATUS_LABELS[status] || status}
                  count={count}
                  total={Object.values(stats.requestStatus).reduce((a, b) => a + b, 0)}
                />
              ))}
              {Object.keys(stats.requestStatus).length === 0 && (
                <p className="text-sm text-gray-400">Nicio cerere</p>
              )}
            </div>
          </div>

          {/* Feedback Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Distribuție feedback
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.feedbackStatus).map(([status, count]) => (
                <StatusRow
                  key={status}
                  label={STATUS_LABELS[status] || status}
                  count={count}
                  total={Object.values(stats.feedbackStatus).reduce((a, b) => a + b, 0)}
                />
              ))}
              {Object.keys(stats.feedbackStatus).length === 0 && (
                <p className="text-sm text-gray-400">Niciun feedback</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Institutions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Top instituții solicitate
          </h2>
          {stats.topInstitutions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Instituție</th>
                    <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Total cereri</th>
                    <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Răspunse</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Rată răspuns</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topInstitutions.map((inst, i) => {
                    const rate = inst.total > 0 ? Math.round((inst.answered / inst.total) * 100) : 0;
                    return (
                      <tr
                        key={inst.name}
                        className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-gray-400">{i + 1}</td>
                        <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">
                          {inst.name}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                          {inst.total}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                          {inst.answered}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              rate >= 75
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : rate >= 40
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nicio cerere trimisă</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function KPICard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    sky: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20',
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    rose: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20',
  };

  const valueColorMap: Record<string, string> = {
    sky: 'text-sky-700 dark:text-sky-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    amber: 'text-amber-700 dark:text-amber-300',
    rose: 'text-rose-700 dark:text-rose-300',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.sky}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </p>
      <p className={`text-3xl font-bold mt-2 ${valueColorMap[color] || valueColorMap.sky}`}>
        {value.toLocaleString('ro-RO')}
      </p>
    </div>
  );
}

function ActivityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {value.toLocaleString('ro-RO')}
      </span>
    </div>
  );
}

function StatusRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {count}
        </span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-sky-500 dark:bg-sky-400 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
