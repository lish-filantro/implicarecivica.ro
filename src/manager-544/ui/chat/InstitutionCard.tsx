'use client';

import React, { useState } from 'react';
import type { ConversationHandoff } from '@m544/shared/types/chat';

export const PREPARE_LABEL = 'Pregătește cererile';
export const REOPEN_LABEL = 'Deschide cererile';
export const NO_EMAIL_HINT =
  'Nu am găsit o adresă oficială de email. Cere asistentului să o caute din nou sau scrie-i adresa dacă o cunoști.';
export const LOW_CONFIDENCE_HINT = 'Adresă cu încredere scăzută. Verifică pe site-ul oficial înainte de trimitere.';

interface InstitutionCardProps {
  handoff: ConversationHandoff;
  /** Opens the request wizard for this conversation. */
  onPrepare: () => void;
  /** "Caută din nou": asks the assistant for another institution. */
  onReject: () => void;
  /** "Introducere manuală": opens the empty wizard. */
  onManualEntry: () => void;
  busy?: boolean;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const PRIMARY =
  'px-4 py-2.5 min-h-[44px] text-sm font-medium bg-grassroots-green-500 hover:bg-grassroots-green-600 text-white rounded-lg transition-colors shadow-sm disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none';
const SECONDARY =
  'px-4 py-2.5 min-h-[44px] text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors';
const TERTIARY =
  'px-4 py-2.5 min-h-[44px] text-sm font-medium bg-civic-blue-100 dark:bg-civic-blue-900/20 hover:bg-civic-blue-200 dark:hover:bg-civic-blue-900/30 text-civic-blue-700 dark:text-civic-blue-300 rounded-lg transition-colors';

/**
 * The card under the assistant's message that identified the institution:
 * name, email, source, confidence, and the hand-off to the request wizard.
 * States: no email (primary disabled + hint), low confidence (warning),
 * confirmed (reopen), session created (dashboard link + "Cereri noi").
 */
export default function InstitutionCard({ handoff, onPrepare, onReject, onManualEntry, busy = false }: InstitutionCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const hasEmail = Boolean(handoff.institutionEmail);
  const low = handoff.emailConfidence === 'low';

  return (
    <div
      role="region"
      aria-label="Instituție identificată"
      className="ml-10 sm:ml-13 mt-2 max-w-[85%] sm:max-w-xl rounded-2xl border border-grassroots-green-200 dark:border-grassroots-green-900/40 bg-white/90 dark:bg-gray-800/90 shadow-md px-4 py-3 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Instituție identificată</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">{handoff.institutionName}</p>
        </div>
        {handoff.sessionId ? (
          <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-civic-blue-100 dark:bg-civic-blue-900/40 text-civic-blue-700 dark:text-civic-blue-300">
            Sesiune creată
          </span>
        ) : handoff.confirmedAt ? (
          <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-grassroots-green-100 dark:bg-grassroots-green-900/40 text-grassroots-green-700 dark:text-grassroots-green-300">
            Confirmată
          </span>
        ) : null}
      </div>

      <dl className="text-sm space-y-1">
        <div className="flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400 shrink-0">Email:</dt>
          <dd className="text-gray-800 dark:text-gray-200 break-all">
            {hasEmail ? handoff.institutionEmail : <span className="italic text-gray-500 dark:text-gray-400">negăsit</span>}
          </dd>
        </div>
        {handoff.sourceUrl && (
          <div className="flex gap-2">
            <dt className="text-gray-500 dark:text-gray-400 shrink-0">Sursa:</dt>
            <dd>
              <a
                href={handoff.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {hostOf(handoff.sourceUrl)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {hasEmail && low && (
        <p className="text-xs text-activist-orange-700 dark:text-activist-orange-300 bg-activist-orange-50 dark:bg-activist-orange-900/20 rounded-lg px-3 py-2">
          ⚠️ {LOW_CONFIDENCE_HINT}
        </p>
      )}
      {!hasEmail && !handoff.sessionId && (
        <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 rounded-lg px-3 py-2">{NO_EMAIL_HINT}</p>
      )}

      {handoff.sessionId ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 sm:mr-auto self-center">
            Cererile către această instituție au fost create.{' '}
            <a href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
              Vezi în dashboard
            </a>
          </p>
          <a href={`/requests/add?session=${encodeURIComponent(handoff.sessionId)}`} className={TERTIARY + ' inline-flex items-center'}>
            Cereri noi
          </a>
        </div>
      ) : !rejecting ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <button type="button" onClick={onPrepare} disabled={!hasEmail || busy} className={PRIMARY}>
            {busy ? 'Se pregătește…' : handoff.confirmedAt ? REOPEN_LABEL : PREPARE_LABEL}
          </button>
          <button type="button" onClick={() => setRejecting(true)} className={SECONDARY}>
            Nu e instituția corectă
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Ce dorești să faci?</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                onReject();
              }}
              className={TERTIARY}
            >
              Caută din nou
            </button>
            <button type="button" onClick={onManualEntry} className={SECONDARY}>
              Introducere manuală
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="px-3 text-sm text-gray-500 dark:text-gray-400 hover:underline">
              Înapoi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
