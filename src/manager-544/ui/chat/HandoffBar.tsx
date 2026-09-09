'use client';

import React from 'react';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { PREPARE_LABEL } from './InstitutionCard';

interface HandoffBarProps {
  handoff: ConversationHandoff;
  onPrepare: () => void;
  busy?: boolean;
}

/**
 * Sticky action above the chat input while an identified institution waits for
 * confirmation, so the hand-off stays reachable after further messages.
 * Rendered by ChatView only when the hand-off is neither confirmed nor sent.
 */
export default function HandoffBar({ handoff, onPrepare, busy = false }: HandoffBarProps) {
  const hasEmail = Boolean(handoff.institutionEmail);
  return (
    <div
      role="status"
      className="px-3 py-2 sm:px-6 border-t border-grassroots-green-200 dark:border-grassroots-green-900/40 bg-grassroots-green-50 dark:bg-grassroots-green-900/20 flex items-center justify-between gap-3"
    >
      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 truncate">
        <span className="text-gray-500 dark:text-gray-400">Instituție identificată: </span>
        <span className="font-medium">{handoff.institutionName}</span>
        {!hasEmail && <span className="text-gray-500 dark:text-gray-400"> · fără adresă de email</span>}
      </p>
      <button
        type="button"
        onClick={onPrepare}
        disabled={!hasEmail || busy}
        className="shrink-0 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium bg-grassroots-green-500 hover:bg-grassroots-green-600 text-white rounded-lg transition-colors shadow-sm disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        {busy ? 'Se pregătește…' : PREPARE_LABEL}
      </button>
    </div>
  );
}
