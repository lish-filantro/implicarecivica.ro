'use client';

import { Search, Mail } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import type { Email, ProcessingStatus } from '@/lib/types/email';
import type { EmailCategory } from '@/lib/types/request';
import type { EmailFolder } from './EmailSidebar';

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  activeFolder: EmailFolder;
  search: string;
  onSearchChange: (value: string) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const CATEGORY_LABELS: Record<EmailCategory, { label: string; className: string }> = {
  trimise: { label: 'Trimis', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  inregistrate: { label: 'Înregistrat', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  amanate: { label: 'Amânat', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  raspunse: { label: 'Răspuns', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  intarziate: { label: 'Întârziat', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  if (status === 'completed') return null;
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Neprocesar', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
    processing: { label: 'Se procesează...', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 animate-pulse' },
    failed: { label: 'Eșuat', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };
  const c = config[status];
  if (!c) return null;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.className}`}>{c.label}</span>;
}

export default function EmailList({
  emails,
  loading,
  selectedEmailId,
  onSelectEmail,
  activeFolder,
  search,
  onSearchChange,
}: EmailListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Caută în emailuri..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 focus:border-civic-blue-500
                       transition-all duration-200"
          />
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto scrollbar-modern">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
              <Mail className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {search ? 'Niciun rezultat' : 'Niciun email'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {search
                ? 'Încearcă alt termen de căutare'
                : activeFolder === 'sent'
                  ? 'Nu ai trimis încă niciun email'
                  : 'Nu ai primit încă niciun email'}
            </p>
          </div>
        ) : (
          emails.map((email) => {
            const isSelected = selectedEmailId === email.id;
            const isUnread = !email.is_read && email.type === 'received';
            const preview = email.body ? stripHtml(email.body).slice(0, 80) : '';
            const contactEmail = email.type === 'sent' ? email.to_email : email.from_email;

            return (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800
                           transition-colors duration-150
                           ${isSelected
                             ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20'
                             : isUnread
                               ? 'bg-civic-blue-50/30 dark:bg-civic-blue-900/10 hover:bg-civic-blue-50/50 dark:hover:bg-civic-blue-900/20'
                               : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                           }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {email.type === 'sent' ? `Către: ${contactEmail}` : contactEmail}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                    {formatDate(email.created_at, 'relative')}
                  </span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${isUnread ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                  {email.subject}
                </p>
                {preview && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {preview}
                  </p>
                )}
                {/* Category badge + processing status */}
                {email.type === 'received' && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {email.category && CATEGORY_LABELS[email.category] && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_LABELS[email.category].className}`}>
                        {CATEGORY_LABELS[email.category].label}
                      </span>
                    )}
                    <ProcessingBadge status={email.processing_status} />
                    {email.request_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Asociat
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
