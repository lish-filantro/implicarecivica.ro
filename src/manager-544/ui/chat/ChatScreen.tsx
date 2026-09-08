'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useConversation } from './hooks/useConversation';
import { useChatSidebar } from './hooks/useChatSidebar';
import ChatView from './ChatView';

interface ChatScreenProps {
  /** Existing conversation to load; omitted for a new chat. */
  conversationId?: string;
}

/** Spinner shown while an existing conversation's messages are loading. */
export function ConversationLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-civic-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Se incarca conversatia...</p>
      </div>
    </div>
  );
}

/**
 * The chat page body shared by /chat (new conversation) and /chat/[conversationId]:
 * wires useConversation to ChatView and hands the identified institution to the
 * request wizard through sessionStorage.
 */
export default function ChatScreen({ conversationId }: ChatScreenProps) {
  const router = useRouter();
  const { toggle } = useChatSidebar();
  const {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    isTyping,
    aiStatus,
    isLoading,
    extractInstitutionData,
    failedMessage,
    retryLastMessage,
  } = useConversation({ conversationId });

  const handleConfirmInstitution = useCallback(() => {
    const data = extractInstitutionData();
    if (data) {
      sessionStorage.setItem('requestWizardData', JSON.stringify(data));
      router.push('/requests/new?from=chat');
    }
  }, [extractInstitutionData, router]);

  const handleManualEntry = useCallback(() => {
    router.push('/requests/new');
  }, [router]);

  if (conversationId && isLoading) {
    return <ConversationLoading />;
  }

  return (
    <ChatView
      messages={messages}
      inputMessage={inputMessage}
      setInputMessage={setInputMessage}
      onSendMessage={sendMessage}
      isTyping={isTyping}
      aiStatus={aiStatus}
      onConfirmInstitution={handleConfirmInstitution}
      onManualEntry={handleManualEntry}
      onToggleSidebar={toggle}
      failedMessage={failedMessage}
      onRetry={retryLastMessage}
    />
  );
}
