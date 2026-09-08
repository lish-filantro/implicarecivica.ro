'use client';

import { formatDate } from '@/lib/utils';
import type { Email } from '@m544/shared/types/email';
import { CategoryBadge, ProcessingBadge } from './badges';

/** Subject, badges and the From / To / date / registration-number meta line. */
export default function EmailDetailHeader({ email }: { email: Email }) {
  return (
    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{email.subject}</h2>
        {email.type === 'received' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {email.category && <CategoryBadge category={email.category} variant="detail" />}
            <ProcessingBadge status={email.processing_status} variant="detail" />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
        <span>
          <span className="font-medium text-gray-700 dark:text-gray-300">De la:</span> {email.from_email}
        </span>
        <span>
          <span className="font-medium text-gray-700 dark:text-gray-300">Către:</span> {email.to_email}
        </span>
        <span>{formatDate(email.created_at, 'long')}</span>
        {email.registration_number && (
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            Nr. {email.registration_number}
          </span>
        )}
      </div>
    </div>
  );
}
