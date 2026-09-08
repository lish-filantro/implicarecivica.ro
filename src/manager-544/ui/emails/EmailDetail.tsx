'use client';

import { Mail, Reply, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Email } from '@m544/shared/types/email';
import EmailAttachments from './EmailAttachments';
import EmailDetailHeader from './EmailDetailHeader';
import ReclassifyMenu from './review/ReclassifyMenu';
import ReviewPanel, { type LoadOpenRequests } from './review/ReviewPanel';
import { useReview, type ReviewPost } from './review/useReview';
import { sanitizeEmailHtml } from './sanitize';

export interface EmailDetailProps {
  email: Email;
  /** Called with the refreshed email after a successful review action. */
  onUpdated?: (email: Email) => void;
  /** Open requests for the "assign" select (default: browser query). */
  loadOpenRequests?: LoadOpenRequests;
  /** Transport for the review API (default: fetch). */
  post?: ReviewPost;
}

/** A received email whose classification finished can have its category corrected. */
export function canReclassify(email: Email): boolean {
  return email.type === 'received' && email.processing_status === 'completed';
}

export default function EmailDetail({ email, onUpdated, loadOpenRequests, post }: EmailDetailProps) {
  const review = useReview({ post, onUpdated });

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <EmailDetailHeader email={email} />

      {email.type === 'received' && email.needs_review && (
        <ReviewPanel email={email} review={review} loadOpenRequests={loadOpenRequests} />
      )}

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
      <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
          <Reply className="h-4 w-4" />
          Răspunde (în curând)
        </Button>
        <Button variant="ghost" size="sm" className="gap-2 text-protest-red-600 hover:text-protest-red-700 hover:bg-protest-red-50 dark:hover:bg-protest-red-900/20">
          <Trash2 className="h-4 w-4" />
          Șterge
        </Button>
        {canReclassify(email) && (
          <div className="ml-auto flex-1 sm:flex-none flex justify-end">
            <ReclassifyMenu email={email} review={review} />
          </div>
        )}
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
