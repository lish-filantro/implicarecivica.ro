'use client';

import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import type { SessionStats } from '@m544/requests/utils/session-stats';
import { SessionCard } from './SessionCard';
import { SessionFilters } from './SessionFilters';
import type { SessionFilter } from './stats';

interface SessionListProps {
  /** All sessions (for the header counts and the filter buttons). */
  sessions: RequestSessionWithRequests[];
  /** Sessions after the status filter, already sorted. */
  filteredSessions: RequestSessionWithRequests[];
  sessionStats: SessionStats;
  statusFilter: SessionFilter;
  onFilterChange: (filter: SessionFilter) => void;
  onOpenDetail: (session: RequestSessionWithRequests) => void;
}

export function SessionList({
  sessions,
  filteredSessions,
  sessionStats,
  statusFilter,
  onFilterChange,
  onOpenDetail,
}: SessionListProps) {
  return (
    /* Sessions List */
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
        <SessionFilters
          sessionCount={sessions.length}
          sessionStats={sessionStats}
          statusFilter={statusFilter}
          onChange={onFilterChange}
        />
      </div>

      {filteredSessions.length > 0 ? (
        <div className="space-y-4">
          {filteredSessions.map((session, index) => (
            <div
              key={session.id}
              className="animate-slide-in"
              style={{ animationDelay: `${(index + 6) * 50}ms` }}
            >
              <SessionCard session={session} onOpenDetail={onOpenDetail} />
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
  );
}
