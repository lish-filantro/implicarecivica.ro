'use client';

import type { Request } from '@/lib/types/request';
import { AnswerRenderer } from './AnswerRenderer';
import {
  getRequestQuestion,
  getStatusLabel,
  getEffectiveDeadline,
  getDaysUntilDeadline,
  isOverdueRequest,
} from '@/lib/utils/requestUtils';

interface SessionRequestItemProps {
  request: Request;
  index: number;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function SessionRequestItem({ request, index }: SessionRequestItemProps) {
  const isOverdue = isOverdueRequest(request);
  const effectiveDeadline = getEffectiveDeadline(request);
  const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline) : null;
  const question = getRequestQuestion(request);
  const hasAnswer = request.status === 'answered' && request.answer_summary;

  // Border left color based on status
  const borderColor = request.status === 'answered'
    ? 'border-l-emerald-500'
    : isOverdue
      ? 'border-l-rose-500'
      : request.status === 'extension'
        ? 'border-l-purple-500'
        : request.status === 'received'
          ? 'border-l-amber-500'
          : 'border-l-blue-500';

  return (
    <div className={`border-l-4 ${borderColor} bg-white dark:bg-gray-800/60 rounded-r-lg p-4 shadow-sm`}>
      {/* Row 1: Status icon + question */}
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="shrink-0 mt-0.5">
          {request.status === 'answered' ? (
            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isOverdue ? (
            <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
            </div>
          )}
        </div>

        {/* Question + status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
            {question || request.subject || 'Fără conținut'}
          </p>
        </div>
      </div>

      {/* Row 2: Metadata */}
      <div className="flex items-center gap-3 mt-2 ml-9 flex-wrap">
        {/* Status badge */}
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
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

        {/* Registration number */}
        {request.registration_number && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
            Nr. {request.registration_number}
          </span>
        )}

        {/* Date sent */}
        {request.date_sent && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Trimis: {formatDate(request.date_sent)}
          </span>
        )}

        {/* Date received (response) */}
        {request.response_received_date && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Răspuns: {formatDate(request.response_received_date)}
          </span>
        )}

        {/* Deadline */}
        {request.status !== 'answered' && daysLeft !== null && (
          <span className={`text-[11px] font-medium ${
            daysLeft < 0
              ? 'text-rose-600 dark:text-rose-400'
              : daysLeft <= 3
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            {daysLeft < 0
              ? `${Math.abs(daysLeft)} zile întârziere`
              : `${daysLeft} zile rămase`
            }
          </span>
        )}
      </div>

      {/* Row 3: Answer (if exists) or waiting status */}
      {hasAnswer ? (
        <div className="mt-3 ml-9 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
            Răspuns
          </p>
          <AnswerRenderer summary={request.answer_summary} />
        </div>
      ) : request.status !== 'answered' && (
        <div className="mt-3 ml-9 p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            {request.status === 'received' || request.status === 'extension'
              ? 'Cerere înregistrată, în așteptarea răspunsului'
              : 'În așteptarea confirmării de înregistrare'
            }
          </p>
        </div>
      )}
    </div>
  );
}
