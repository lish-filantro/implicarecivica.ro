'use client';

import ChatLayoutShell from '@m544/ui/chat/ChatLayoutShell';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatLayoutShell>{children}</ChatLayoutShell>;
}
