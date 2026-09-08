'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import type { RateLimitInfo } from '../rate-limit';

interface RateLimitNoticeProps {
  rateLimit: RateLimitInfo;
  selectedCount: number;
  exceedsLimit: boolean;
}

/** The daily-limit banner of the preview modal (red when the selection exceeds what is left). */
export function RateLimitNotice({ rateLimit, selectedCount, exceedsLimit }: RateLimitNoticeProps) {
  return (
    <div className={`mx-6 mt-2 flex items-start gap-3 p-3 rounded-lg border ${
      exceedsLimit
        ? 'bg-protest-red-50 dark:bg-protest-red-900/10 border-protest-red-200 dark:border-protest-red-800/30'
        : 'bg-civic-blue-50 dark:bg-civic-blue-900/10 border-civic-blue-200 dark:border-civic-blue-800/30'
    }`}>
      <Shield className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
        exceedsLimit
          ? 'text-protest-red-600 dark:text-protest-red-400'
          : 'text-civic-blue-600 dark:text-civic-blue-400'
      }`} />
      <div className={`text-xs space-y-1 ${
        exceedsLimit
          ? 'text-protest-red-800 dark:text-protest-red-300'
          : 'text-civic-blue-800 dark:text-civic-blue-300'
      }`}>
        <p>
          Limita zilnică: <strong>{rateLimit.limit} cereri</strong> per instituție.
          {rateLimit.sent_today > 0 && (
            <> Azi ai trimis <strong>{rateLimit.sent_today}</strong>.</>
          )}
          {' '}Mai poți trimite <strong>{rateLimit.remaining}</strong>.
        </p>
        {exceedsLimit && (
          <p className="font-semibold">
            Ai selectat {selectedCount} cereri, dar mai poți trimite doar {rateLimit.remaining}.
            {rateLimit.remaining === 0
              ? ' Încearcă din nou mâine.'
              : ' Reduce numărul de cereri selectate.'}
          </p>
        )}
      </div>
    </div>
  );
}
