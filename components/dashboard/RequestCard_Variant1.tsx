/**
 * RequestCard - VARIANTA 1: Badge-uri Simple
 * Elimină complet icon containers, folosește badge-uri mici cu emoji
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
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 rounded-t-xl">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {request.institution_name || 'Instituție necunoscută'}
          </h3>

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

        {request.registration_number && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md shrink-0 ml-3">
            #{request.registration_number}
          </span>
        )}
      </div>

      {/* BODY */}
      <div className="flex" style={{ minHeight: '140px' }}>

        {/* LEFT: Question */}
        <div className={`flex flex-col ${hasAnswer ? 'w-1/2' : 'flex-1'} p-5 border-r border-gray-100 dark:border-gray-700/50`}>
          {/* Badge Question */}
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-400 mb-3 w-fit px-2.5 py-1 rounded-full bg-violet-100/80 dark:bg-violet-900/30">
            <span>📝</span>
            <span>ÎNTREBARE</span>
          </div>

          {/* Question Text */}
          <div className="flex-1 min-h-0">
            <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {getRequestQuestion(request) || request.subject || 'Fără conținut'}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Answer OR Status */}
        {hasAnswer ? (
          <div className="flex flex-col w-1/2 p-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/5 rounded-br-xl">
            {/* Badge Answer */}
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-3 w-fit px-2.5 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30">
              <span>✅</span>
              <span>RĂSPUNS</span>
            </div>

            {/* Answer text */}
            <div className="flex-1 min-h-0">
              <div className="max-h-20 overflow-y-auto custom-scrollbar pr-2">
                <AnswerRenderer summary={request.answer_summary} />
              </div>
            </div>

            {/* Date */}
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
        ) : (
          <div className="flex flex-col items-end justify-center p-5 min-w-[160px]">
            {isOverdueRegistration && (
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800 animate-pulse">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Fără confirmare de {daysSinceSent} zile</span>
              </div>
            )}

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

            <div className="mt-3 text-right">
              {isPendingWithoutReg && !isOverdueRegistration ? (
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
