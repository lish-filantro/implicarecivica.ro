'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Clock, Shield } from 'lucide-react';
import { FOIA_MESSAGES, FOIA_CYCLE_MS } from './foia-messages';

interface SendProgressProps {
  sent: number;
  total: number;
  secondsLeft: number | null;
}

/** Footer of the preview modal while sending: counter, bar, cycling civic message, countdown. */
export function SendProgress({ sent, total, secondsLeft }: SendProgressProps) {
  const [foiaIndex, setFoiaIndex] = useState(0);

  // Cycle FOIA messages every 4s while mounted (i.e. while sending)
  useEffect(() => {
    const interval = setInterval(() => {
      setFoiaIndex((prev) => (prev + 1) % FOIA_MESSAGES.length);
    }, FOIA_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = total > 0 ? (sent / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-civic-blue-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Trimitere: {sent}/{total}
          </span>
        </div>
        {sent < total && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Shield className="h-3.5 w-3.5" />
            <span>Nu reîncărca pagina</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-civic-blue-600 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* FOIA civic message — cycling */}
      <div className="min-h-[2.5rem] flex items-center justify-center">
        <p
          key={foiaIndex}
          className="text-sm text-gray-600 dark:text-gray-400 italic text-center animate-fade-in"
        >
          &ldquo;{FOIA_MESSAGES[foiaIndex]}&rdquo;
        </p>
      </div>

      {/* Countdown to next email */}
      {secondsLeft !== null && secondsLeft > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span>Următorul email în: <strong className="tabular-nums">{secondsLeft}s</strong></span>
        </div>
      )}
    </div>
  );
}
