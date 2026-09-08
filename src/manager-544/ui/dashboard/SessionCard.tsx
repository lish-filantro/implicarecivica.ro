'use client';

import { useState } from 'react';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import {
  getSessionStatusLabel,
  getSessionStatusColor,
  getSessionProgress,
  getSessionDaysUntilDeadline,
} from '@m544/requests/utils/session-stats';
import { RequestRow } from './RequestRow';

interface SessionCardProps {
  session: RequestSessionWithRequests;
  onOpenDetail?: (session: RequestSessionWithRequests) => void;
}

export function SessionCard({ session, onOpenDetail }: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor = getSessionStatusColor(session.cached_status);
  const progress = getSessionProgress(session);
  const daysLeft = getSessionDaysUntilDeadline(session);
  const isMultiRequest = session.total_requests > 1;

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-800/80 transition-all duration-200 shadow-sm hover:shadow-xl ${
      isExpanded
        ? 'ring-2 ring-primary/30 border-primary/30'
        : 'border-gray-200/80 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'
    }`}>
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 rounded-t-xl">
        <button
          type="button"
          onClick={() => onOpenDetail?.(session)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {session.institution_name}
          </h3>

          <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ring-1 ${statusColor.bg} ${statusColor.text} ${statusColor.ring}`}>
            {getSessionStatusLabel(session.cached_status)}
          </span>
        </button>

        {/* Expand/collapse chevron */}
        {isMultiRequest && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors shrink-0 ml-3"
            aria-label={isExpanded ? 'Restrânge' : 'Expandează'}
          >
            <svg
              className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* BODY — summary info, click opens modal */}
      <button
        type="button"
        onClick={() => onOpenDetail?.(session)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between px-5 py-4">
          {/* Left: name/subject + request count */}
          <div className="min-w-0 flex-1">
            {session.name && (
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {session.name}
              </p>
            )}
            <p className={`text-sm truncate ${session.name ? 'text-gray-500 dark:text-gray-400 text-xs' : 'text-gray-700 dark:text-gray-300'}`}>
              {session.subject}
            </p>
            {isMultiRequest && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {session.total_requests} cereri
                {session.answered_requests > 0 && ` · ${session.answered_requests} răspunse`}
              </p>
            )}
          </div>

          {/* Right: progress + deadline */}
          <div className="flex items-center gap-4 shrink-0 ml-4">
            {/* Progress bar (only for multi-request sessions) */}
            {isMultiRequest && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      session.cached_status === 'completed'
                        ? 'bg-emerald-500'
                        : session.cached_status === 'overdue'
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                  {session.answered_requests}/{session.total_requests}
                </span>
              </div>
            )}

            {/* Deadline */}
            {session.cached_status !== 'completed' && daysLeft !== null && (
              <span className={`text-xs font-semibold ${
                daysLeft < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : daysLeft <= 3
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-400'
              }`}>
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}z întârziere`
                  : `${daysLeft}z rămase`
                }
              </span>
            )}

            {session.cached_status === 'completed' && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Finalizată
              </span>
            )}
          </div>
        </div>
      </button>

      {/* EXPANDED — individual requests list */}
      {isExpanded && isMultiRequest && session.requests.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-900/20 rounded-b-xl">
          {session.requests.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
