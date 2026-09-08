'use client';

/** One request line inside an expanded SessionCard. */
import type { Request } from '@m544/shared/types/request';
import {
  getRequestQuestion,
  getStatusLabel,
  getEffectiveDeadline,
  getDaysUntilDeadline,
  isOverdueRequest,
} from '@m544/requests/utils';

export function RequestRow({ request }: { request: Request }) {
  const isOverdue = isOverdueRequest(request);
  const effectiveDeadline = getEffectiveDeadline(request);
  const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline) : null;
  const question = getRequestQuestion(request);

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Status icon */}
      <div className="shrink-0">
        {request.status === 'answered' ? (
          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isOverdue ? (
          <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
            <svg className="w-3 h-3 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01" />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
          </div>
        )}
      </div>

      {/* Question text */}
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
        {question || request.subject || 'Fără conținut'}
      </p>

      {/* Status badge */}
      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
        request.status === 'answered'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : isOverdue
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
            : request.status === 'extension'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              : request.status === 'received'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      }`}>
        {isOverdue ? 'Întârziată' : getStatusLabel(request.status)}
      </span>

      {/* Deadline info */}
      {request.status !== 'answered' && daysLeft !== null && (
        <span className={`shrink-0 text-[10px] font-medium ${
          daysLeft < 0
            ? 'text-rose-600 dark:text-rose-400'
            : daysLeft <= 3
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-500 dark:text-gray-400'
        }`}>
          {daysLeft < 0
            ? `${Math.abs(daysLeft)}z întârziere`
            : `${daysLeft}z rămase`
          }
        </span>
      )}
    </div>
  );
}
