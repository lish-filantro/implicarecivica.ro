'use client';

import type { SessionStats } from '@m544/requests/utils/session-stats';
import type { SessionFilter } from './stats';

interface SessionFiltersProps {
  /** Number of sessions (the "Toate" count); nothing renders when 0. */
  sessionCount: number;
  sessionStats: SessionStats;
  statusFilter: SessionFilter;
  onChange: (filter: SessionFilter) => void;
}

/** Status filters — only the buckets that have sessions are shown. */
export function SessionFilters({ sessionCount, sessionStats, statusFilter, onChange }: SessionFiltersProps) {
  if (sessionCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {([
        { key: 'all' as const, label: 'Toate', count: sessionCount },
        { key: 'pending' as const, label: 'În așteptare', count: sessionStats.by_status.pending },
        { key: 'in_progress' as const, label: 'În curs', count: sessionStats.by_status.in_progress },
        { key: 'partial_answered' as const, label: 'Parțial', count: sessionStats.by_status.partial_answered },
        { key: 'completed' as const, label: 'Finalizate', count: sessionStats.by_status.completed },
        { key: 'overdue' as const, label: 'Întârziate', count: sessionStats.by_status.overdue },
      ] as const).filter((f) => f.key === 'all' || f.count > 0).map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
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
  );
}
