'use client';

import { useConversation } from '@/lib/hooks/useConversation';
import ChatView from '@/components/chat/ChatView';

export default function NewChatPage() {
  const {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    isTyping,
    aiStatus,
  } = useConversation();

  return (
    <ChatView
      messages={messages}
      inputMessage={inputMessage}
      setInputMessage={setInputMessage}
      onSendMessage={sendMessage}
      isTyping={isTyping}
      aiStatus={aiStatus}
    />
  );
}
