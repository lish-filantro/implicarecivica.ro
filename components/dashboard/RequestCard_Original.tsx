/**
 * RequestCard Component
 * Displays a request with question/answer split layout
 * Adapts based on whether answer exists (50-50 split vs full width)
 */

'use client';

import { AnswerRenderer } from './AnswerRenderer';
import {
  getRequestQuestion,
  getEffectiveDeadline,
  getDaysUntilDeadline,
  getDaysSinceSent,
  getStatusLabel,
  isOverdueRequest
} from '@/lib/utils/requestUtils';
import type { Request } from '@/lib/types/request';

interface RequestCardProps {
  request: Request;
  onClick?: () => void;
  isSelected?: boolean;
}

export function RequestCard({ request, onClick, isSelected = false }: RequestCardProps) {
  const effectiveDeadline = getEffectiveDeadline(request);
  const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline) : null;
  const isDeadlineExceeded = isOverdueRequest(request);
  const isUrgent = request.status !== 'answered' && !isDeadlineExceeded && daysLeft !== null && daysLeft <= 3;
  const hasAnswer = request.status === 'answered' && request.answer_summary;

  // Calculate days without registration for pending requests
  const daysSinceSent = getDaysSinceSent(request);
  const isPendingWithoutReg = request.status === 'pending' && !request.registration_number;
  const isOverdueRegistration = isPendingWithoutReg && daysSinceSent > 7;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`w-full rounded-xl border bg-white dark:bg-gray-800/80 text-left transition-all duration-200 hover:shadow-xl hover:scale-[1.005] ${
        isSelected
          ? 'ring-2 ring-primary border-primary/50 shadow-lg'
          : 'border-gray-200/80 dark:border-gray-700/50 shadow-sm hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* HEADER: Institution + Status + Registration Number */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 rounded-t-xl">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Institution Icon */}
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>

          {/* Institution Name */}
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {request.institution_name || 'Instituție necunoscută'}
          </h3>

          {/* Status Badge */}
          <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${
            request.status === 'answered'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : request.status === 'extension'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : isDeadlineExceeded
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  : request.registration_number
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {request.status === 'answered'
              ? 'Răspuns primit'
              : request.status === 'extension'
                ? `Răspuns amânat cu ${request.extension_days || 30} zile`
                : isDeadlineExceeded
                  ? 'Termen legal depășit'
                  : request.registration_number
                    ? 'Cerere înregistrată, în așteptarea unui răspuns'
                    : 'Cerere în așteptarea unui număr de înregistrare'
            }
          </span>
        </div>

        {/* Registration Number */}
        {request.registration_number && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md shrink-0 ml-3">
            #{request.registration_number}
          </span>
        )}
      </div>

      {/* BODY: Question (left) + Answer/Status (right) */}
      <div className="flex" style={{ minHeight: '140px' }}>

        {/* LEFT: Question Section - ALWAYS VISIBLE */}
        <div className={`flex ${hasAnswer ? 'w-1/2' : 'flex-1'}`}>

          {/* Question Icon Container - Discrete */}
          <div className="shrink-0 w-12 bg-gradient-to-b from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20 flex items-center justify-center border-r border-violet-200/50 dark:border-violet-800/30">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
          </div>

          {/* Question Text */}
          <div className="flex-1 p-4 min-w-0">
            <div className="max-h-28 overflow-y-auto custom-scrollbar pr-2">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {getRequestQuestion(request) || request.subject || 'Fără conținut'}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Answer OR Status */}
        {hasAnswer ? (
          /* ANSWERED: Show Answer Section */
          <div className="w-1/2 flex">
            {/* Answer Icon Container - Discrete */}
            <div className="shrink-0 w-12 bg-gradient-to-b from-emerald-100 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 flex items-center justify-center border-x border-emerald-200/50 dark:border-emerald-800/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Answer Content */}
            <div className="flex-1 flex flex-col justify-between p-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/5 rounded-br-xl min-w-0">
              {/* Answer text - scrollable */}
              <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2">
                <AnswerRenderer summary={request.answer_summary} />
              </div>

              {/* Date - bottom right */}
              <div className="flex justify-end mt-2">
                <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">
                  {new Date(request.updated_at).toLocaleDateString('ro-RO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* IN PROGRESS: Show Status */
          <div className="flex flex-col items-end justify-center p-4 min-w-[160px]">

            {/* Warning badge for overdue confirmation */}
            {isOverdueRegistration && (
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800 animate-pulse">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Fără confirmare de {daysSinceSent} zile</span>
              </div>
            )}

            {/* Status badge */}
            <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
              request.status === 'extension'
                ? 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 dark:from-purple-900/40 dark:to-violet-900/40 dark:text-purple-300 ring-1 ring-purple-200 dark:ring-purple-800'
                : isDeadlineExceeded
                  ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800'
                  : request.registration_number
                    ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800'
                    : isOverdueRegistration
                      ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
            }`}>
              {isDeadlineExceeded ? 'Întârziată' : getStatusLabel(request.status)}
            </span>

            {/* Deadline info */}
            <div className="mt-3 text-right">
              {isPendingWithoutReg && !isOverdueRegistration ? (
                /* Pending without registration (days 1-7) */
                <>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-0.5">
                    Confirmare În
                  </p>
                  <p className={`text-sm font-bold ${
                    (7 - daysSinceSent) <= 2
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {7 - daysSinceSent} zile
                  </p>
                </>
              ) : !isPendingWithoutReg ? (
                /* Normal deadline display */
                <>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-0.5">
                    {request.status === 'extension' ? 'Termen Prelungit' : effectiveDeadline ? 'Termen Limită' : 'Trimisă'}
                  </p>
                  <p className={`text-sm font-bold ${
                    request.status === 'extension'
                      ? 'text-purple-600 dark:text-purple-400'
                      : (daysLeft !== null && daysLeft < 0)
                        ? 'text-red-600 dark:text-red-400'
                        : (daysLeft !== null && daysLeft <= 3)
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {effectiveDeadline
                      ? (daysLeft !== null && daysLeft < 0
                          ? `${Math.abs(daysLeft)} zile întârziere`
                          : `${daysLeft} zile rămase`)
                      : new Date(request.date_sent || request.created_at).toLocaleDateString('ro-RO', {
                          day: '2-digit',
                          month: 'short'
                        })
                    }
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
