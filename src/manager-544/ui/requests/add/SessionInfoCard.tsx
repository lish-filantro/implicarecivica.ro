'use client';

import React from 'react';
import { Building2, Mail } from 'lucide-react';
import type { RequestSession } from '@m544/shared/types/session';

interface SessionInfoCardProps {
  session: Pick<RequestSession, 'institution_name' | 'institution_email' | 'name' | 'total_requests'>;
}

/** Read-only summary of the session new questions are added to. */
export function SessionInfoCard({ session }: SessionInfoCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/20">
          <Building2 className="h-4 w-4 text-civic-blue-600 dark:text-civic-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {session.institution_name}
          </p>
          {session.institution_email && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3 w-3 text-gray-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {session.institution_email}
              </p>
            </div>
          )}
        </div>
      </div>

      {session.name && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Sesiune: {session.name}
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {session.total_requests} cereri trimise anterior
      </p>
    </div>
  );
}
