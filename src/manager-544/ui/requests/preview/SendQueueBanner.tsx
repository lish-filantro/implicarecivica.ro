'use client';

import React, { useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X, Clock } from 'lucide-react';
import { dismissSendQueue, useSendQueueState } from './send-queue-store';

/** How long the "done" state stays on screen before the banner hides itself. */
export const DONE_VISIBLE_MS = 20_000;

/**
 * Progress of the background send, visible on every authenticated page (mounted
 * in the authenticated layout): counter, bar and countdown while sending; a link
 * to the dashboard when done; the error otherwise. Hidden when idle.
 */
export function SendQueueBanner() {
  const s = useSendQueueState();

  useEffect(() => {
    if (s.status !== 'done') return;
    const timer = setTimeout(dismissSendQueue, DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [s.status, s.finishedAt]);

  if (s.status === 'idle') return null;

  const percent = s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Trimiterea cererilor"
      className="fixed top-16 right-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 space-y-2"
    >
      {s.status === 'sending' && (
        <>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-civic-blue-600 shrink-0" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              Se trimit cererile către {s.institutionName}
            </p>
            <span className="ml-auto text-sm tabular-nums text-gray-700 dark:text-gray-300">
              {s.sent}/{s.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-civic-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            {s.secondsLeft !== null && s.secondsLeft > 0 ? (
              <>
                <Clock className="h-3.5 w-3.5" />
                Următorul email în <strong className="tabular-nums">{s.secondsLeft}s</strong>. Nu reîncărca pagina.
              </>
            ) : (
              'Poți naviga în aplicație; nu reîncărca pagina.'
            )}
          </p>
        </>
      )}

      {s.status === 'done' && (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-grassroots-green-600 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-800 dark:text-gray-200 mr-auto">
            <p>
              {s.sent === 1 ? 'Cererea a fost trimisă' : `Toate cele ${s.sent} cereri au fost trimise`} către{' '}
              <strong>{s.institutionName}</strong>.
            </p>
            <a href="/dashboard" className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline">
              Vezi în dashboard
            </a>
          </div>
          <button type="button" onClick={dismissSendQueue} aria-label="Închide" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {s.status === 'error' && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-protest-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-800 dark:text-gray-200 mr-auto">
            <p className="font-medium">Trimiterea a eșuat</p>
            <p className="text-protest-red-700 dark:text-protest-red-300">{s.error}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Redeschide previzualizarea pentru a reîncerca.</p>
          </div>
          <button type="button" onClick={dismissSendQueue} aria-label="Închide" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
