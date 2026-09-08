'use client';

import { use } from 'react';
import ChatScreen from '@m544/ui/chat/ChatScreen';

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  return <ChatScreen conversationId={conversationId} />;
}
