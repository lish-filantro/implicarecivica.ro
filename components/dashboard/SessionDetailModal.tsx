'use client';

import { useEffect, useCallback } from 'react';
import type { RequestSessionWithRequests } from '@/lib/types/session';
import { SessionRequestItem } from './SessionRequestItem';
import {
  getSessionStatusLabel,
  getSessionStatusColor,
  getSessionProgress,
  getSessionDaysUntilDeadline,
} from '@/lib/utils/sessionUtils';

interface SessionDetailModalProps {
  session: RequestSessionWithRequests;
  onClose: () => void;
}

export function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const statusColor = getSessionStatusColor(session.cached_status);
  const progress = getSessionProgress(session);
  const daysLeft = getSessionDaysUntilDeadline(session);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] mt-[5vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
            aria-label="Închide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Institution icon + name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-8">
                {session.name || session.subject}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {session.institution_name}
                {session.institution_email && (
                  <span className="text-gray-400 dark:text-gray-500"> · {session.institution_email}</span>
                )}
              </p>
              {session.name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                  {session.subject}
                </p>
              )}
            </div>
          </div>

          {/* Status bar: badge + progress + deadline */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full ring-1 ${statusColor.bg} ${statusColor.text} ${statusColor.ring}`}>
              {getSessionStatusLabel(session.cached_status)}
            </span>

            {/* Progress */}
            {session.total_requests > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                  {session.answered_requests}/{session.total_requests} răspunse
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
                  ? `${Math.abs(daysLeft)} zile întârziere`
                  : `${daysLeft} zile rămase`
                }
              </span>
            )}
          </div>
        </div>

        {/* Body — scrollable list of requests */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {session.requests.length > 0 ? (
            session.requests.map((request, index) => (
              <SessionRequestItem
                key={request.id}
                request={request}
                index={index}
              />
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 italic">
              Nu există cereri în această sesiune
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
