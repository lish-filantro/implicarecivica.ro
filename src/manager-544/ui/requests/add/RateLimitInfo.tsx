'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import type { RateLimitInfo as RateLimitInfoData } from '../rate-limit';

interface RateLimitInfoProps {
  rateLimit: RateLimitInfoData;
}

/** Daily-limit banner of /requests/add (red once nothing is left for today). */
export function RateLimitInfo({ rateLimit }: RateLimitInfoProps) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border mb-6 ${
      rateLimit.remaining === 0
        ? 'bg-protest-red-50 dark:bg-protest-red-900/10 border-protest-red-200 dark:border-protest-red-800/30'
        : 'bg-civic-blue-50 dark:bg-civic-blue-900/10 border-civic-blue-200 dark:border-civic-blue-800/30'
    }`}>
      <Shield className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
        rateLimit.remaining === 0
          ? 'text-protest-red-600 dark:text-protest-red-400'
          : 'text-civic-blue-600 dark:text-civic-blue-400'
      }`} />
      <p className={`text-xs ${
        rateLimit.remaining === 0
          ? 'text-protest-red-800 dark:text-protest-red-300'
          : 'text-civic-blue-800 dark:text-civic-blue-300'
      }`}>
        Limita zilnică: <strong>{rateLimit.limit} cereri</strong> per instituție.
        {rateLimit.sent_today > 0 && (
          <> Azi ai trimis <strong>{rateLimit.sent_today}</strong>.</>
        )}
        {' '}Mai poți trimite <strong>{rateLimit.remaining}</strong>.
        {rateLimit.remaining === 0 && ' Încearcă din nou mâine.'}
      </p>
    </div>
  );
}
