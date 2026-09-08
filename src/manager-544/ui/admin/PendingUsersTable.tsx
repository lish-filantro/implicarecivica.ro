'use client';

import { useState } from 'react';
import { defaultFetch, type FetchLike, type PendingUser } from './types';

interface PendingUsersTableProps {
  users: PendingUser[];
  /** Called after approve/reject succeeded so the parent can drop the row. */
  onRemoved: (userId: string) => void;
  fetchFn?: FetchLike;
  /** Confirmation prompt for reject; defaults to `window.confirm`. */
  confirmFn?: (message: string) => boolean;
}

/** Pending Accounts — renders nothing when the list is empty. */
export function PendingUsersTable({
  users,
  onRemoved,
  fetchFn = defaultFetch,
  confirmFn = (message) => confirm(message),
}: PendingUsersTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetchFn('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        onRemoved(userId);
      }
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirmFn('Ești sigur că vrei să ștergi acest cont? Acțiunea este ireversibilă.')) return;
    setActionLoading(userId);
    try {
      const res = await fetchFn('/api/admin/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        onRemoved(userId);
      }
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (users.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Conturi în așteptarea aprobării ({users.length})
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
            {users.map((user) => (
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
  );
}
