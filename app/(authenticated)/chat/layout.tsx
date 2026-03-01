'use client';

import ConversationSidebar from '@/components/chat/ConversationSidebar';
import { ChatSidebarProvider, useChatSidebar } from '@/lib/hooks/useChatSidebar';

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useChatSidebar();

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      {/* Sidebar: hidden on mobile, overlay when open */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 ease-in-out
        top-14 bg-gray-50 dark:bg-gray-900
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:top-0 md:translate-x-0 md:z-auto
      `}>
        <ConversationSidebar onNavigate={close} />
      </div>

      {/* Overlay backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={close}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatSidebarProvider>
      <ChatLayoutInner>{children}</ChatLayoutInner>
    </ChatSidebarProvider>
  );
}
