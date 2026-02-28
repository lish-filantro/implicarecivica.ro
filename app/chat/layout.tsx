'use client';

import DarkModeToggle from '@/components/DarkModeToggle';
import ConversationSidebar from '@/components/chat/ConversationSidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DarkModeToggle />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Asistent 544 - Cereri Informații Publice
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Formulare interactive pentru Legea 544/2001
        </p>
      </div>

      <div className="flex h-[calc(100vh-5rem)]">
        <ConversationSidebar />
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
