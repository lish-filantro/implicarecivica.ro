'use client';

import { ArrowLeft } from 'lucide-react';
import { folderBadge } from './EmailSidebar';
import { FOLDER_LABELS, FOLDER_ORDER, type EmailFolder } from './filter';

interface MobileFolderBarProps {
  hasSelection: boolean;
  activeFolder: EmailFolder;
  unreadCount: number;
  /** Received emails flagged needs_review (badge on "De revizuit"). */
  reviewCount?: number;
  onBack: () => void;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
}

/** Fixed header shown only on mobile: folder tabs + compose, or a back button when an email is open. */
export default function MobileFolderBar({
  hasSelection,
  activeFolder,
  unreadCount,
  reviewCount = 0,
  onBack,
  onFolderChange,
  onCompose,
}: MobileFolderBarProps) {
  return (
    <div className="md:hidden fixed top-14 left-0 right-0 z-40
                    bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700
                    flex items-center gap-1 px-3 py-2">
      {hasSelection ? (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi
        </button>
      ) : (
        <>
          {FOLDER_ORDER.map((f) => {
            const badge = folderBadge(f, unreadCount, reviewCount);
            return (
              <button
                key={f}
                onClick={() => onFolderChange(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${activeFolder === f
                    ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                {FOLDER_LABELS[f]}
                {badge !== null && (
                  <span
                    className={`ml-1 px-1 text-xs text-white rounded-full ${f === 'review' ? 'bg-amber-500' : 'bg-civic-blue-500'}`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={onCompose}
            className="ml-auto px-3 py-1 rounded-full text-xs font-semibold
                       bg-activist-orange-500 text-white"
          >
            Compune
          </button>
        </>
      )}
    </div>
  );
}
