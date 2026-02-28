'use client';

import ConversationSidebar from '@/components/chat/ConversationSidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ConversationSidebar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
