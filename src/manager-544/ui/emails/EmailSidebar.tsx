'use client';

import { Inbox, Send, Mail, PenSquare, AlertTriangle } from 'lucide-react';
import { FOLDER_LABELS, FOLDER_ORDER, type EmailFolder } from './filter';

export type { EmailFolder };

interface EmailSidebarProps {
  activeFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  unreadCount: number;
  /** Received emails flagged needs_review (badge on "De revizuit"). */
  reviewCount?: number;
  userEmail: string | null;
}

const ICONS: Record<EmailFolder, typeof Inbox> = { inbox: Inbox, review: AlertTriangle, sent: Send, all: Mail };

/** Count badge shown next to a folder; `null` when there is nothing to show. */
export function folderBadge(folder: EmailFolder, unreadCount: number, reviewCount: number): number | null {
  if (folder === 'inbox' && unreadCount > 0) return unreadCount;
  if (folder === 'review' && reviewCount > 0) return reviewCount;
  return null;
}

export default function EmailSidebar({
  activeFolder,
  onFolderChange,
  onCompose,
  unreadCount,
  reviewCount = 0,
  userEmail,
}: EmailSidebarProps) {
  return (
    <aside className="w-56 flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Compose button */}
      <div className="p-3">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     bg-gradient-to-r from-activist-orange-500 to-activist-orange-600
                     hover:from-activist-orange-600 hover:to-activist-orange-700
                     text-white font-semibold text-sm shadow-lg hover:shadow-xl
                     transition-all duration-300 transform hover:scale-105"
        >
          <PenSquare className="h-4 w-4" />
          Compune
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-2 py-1 space-y-0.5">
        {FOLDER_ORDER.map((folder) => {
          const isActive = activeFolder === folder;
          const Icon = ICONS[folder];
          const badge = folderBadge(folder, unreadCount, reviewCount);
          const badgeColor = folder === 'review' ? 'bg-amber-500' : 'bg-civic-blue-500';
          return (
            <button
              key={folder}
              onClick={() => onFolderChange(folder)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                         transition-all duration-200
                         ${isActive
                           ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                           : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                         }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{FOLDER_LABELS[folder]}</span>
              {badge !== null && (
                <span
                  data-testid={`badge-${folder}`}
                  className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${badgeColor} text-white min-w-[20px] text-center`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User email */}
      {userEmail && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={userEmail}>
            {userEmail}
          </p>
        </div>
      )}
    </aside>
  );
}
