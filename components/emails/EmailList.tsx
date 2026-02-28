'use client';

import { Search, Mail } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import type { Email } from '@/lib/types/email';
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
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
