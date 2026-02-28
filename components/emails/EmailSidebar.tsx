'use client';

import { Inbox, Send, Mail, PenSquare } from 'lucide-react';

export type EmailFolder = 'inbox' | 'sent' | 'all';

interface EmailSidebarProps {
  activeFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  onCompose: () => void;
  unreadCount: number;
  userEmail: string | null;
}

const FOLDERS: { id: EmailFolder; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Primite', icon: Inbox },
  { id: 'sent', label: 'Trimise', icon: Send },
  { id: 'all', label: 'Toate', icon: Mail },
];

export default function EmailSidebar({
  activeFolder,
  onFolderChange,
  onCompose,
  unreadCount,
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
        {FOLDERS.map((folder) => {
          const isActive = activeFolder === folder.id;
          const Icon = folder.icon;
          return (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                         transition-all duration-200
                         ${isActive
                           ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                           : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                         }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.id === 'inbox' && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full
                               bg-civic-blue-500 text-white min-w-[20px] text-center">
                  {unreadCount}
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
