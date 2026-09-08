'use client';

import { Mail, Reply, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Email } from '@m544/shared/types/email';
import { CategoryBadge, ProcessingBadge } from './badges';
import EmailAttachments from './EmailAttachments';
import { sanitizeEmailHtml } from './sanitize';

export default function EmailDetail({ email }: { email: Email }) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Detail header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {email.subject}
          </h2>
          {email.type === 'received' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {email.category && <CategoryBadge category={email.category} variant="detail" />}
              <ProcessingBadge status={email.processing_status} variant="detail" />
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          <span>
            <span className="font-medium text-gray-700 dark:text-gray-300">De la:</span>{' '}
            {email.from_email}
          </span>
          <span>
            <span className="font-medium text-gray-700 dark:text-gray-300">Către:</span>{' '}
            {email.to_email}
          </span>
          <span>{formatDate(email.created_at, 'long')}</span>
          {email.registration_number && (
            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              Nr. {email.registration_number}
            </span>
          )}
        </div>
      </div>

      {/* Detail body */}
      <div className="flex-1 overflow-y-auto scrollbar-modern p-6">
        {email.body ? (
          <div
            className="prose-email text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body) }}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">Fără conținut</p>
        )}

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <EmailAttachments attachments={email.attachments} />
        )}
      </div>

      {/* Detail footer */}
      <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
          <Reply className="h-4 w-4" />
          Răspunde (în curând)
        </Button>
        <Button variant="ghost" size="sm" className="gap-2 text-protest-red-600 hover:text-protest-red-700 hover:bg-protest-red-50 dark:hover:bg-protest-red-900/20">
          <Trash2 className="h-4 w-4" />
          Șterge
        </Button>
      </div>
    </div>
  );
}

/** Right-hand panel placeholder when no email is selected. */
export function EmailEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
        <Mail className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        Selectează un email
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Alege un email din listă pentru a-l vizualiza
      </p>
    </div>
  );
}
