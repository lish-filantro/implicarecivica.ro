'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  listConversations,
  deleteConversation,
} from '@/lib/supabase/chat-queries';
import type { ConversationListItem } from '@/lib/types/chat';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'acum';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}z`;
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

const STEP_LABELS: Record<string, string> = {
  STEP_1: 'Definire',
  STEP_2: 'Instituție',
  STEP_3: 'Întrebări',
};

interface ConversationSidebarProps {
  onNavigate?: () => void;
}

export default function ConversationSidebar({ onNavigate }: ConversationSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Extract active conversation ID from pathname
  const activeId = pathname?.startsWith('/chat/') ? pathname.split('/')[2] : null;

  const refreshList = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList, pathname]); // refresh when navigating

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Ștergi conversația?')) return;
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="Deschide sidebar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversații</h3>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Ascunde sidebar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => { router.push('/chat'); onNavigate?.(); }}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-civic-blue-600 hover:bg-civic-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Conversație nouă
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-modern">
        {conversations.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
            Nicio conversație încă
          </p>
        ) : (
          <div className="py-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { router.push(`/chat/${conv.id}`); onNavigate?.(); }}
                className={`w-full text-left px-4 py-3 group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  activeId === conv.id
                    ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 border-r-2 border-civic-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1 mr-2">
                    {conv.title}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                      title="Șterge"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {conv.messageCount} mesaje
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {STEP_LABELS[conv.currentStep] || conv.currentStep}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
