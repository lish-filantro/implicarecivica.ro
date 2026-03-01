'use client';

import { use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useConversation } from '@/lib/hooks/useConversation';
import { useChatSidebar } from '@/lib/hooks/useChatSidebar';
import ChatView from '@/components/chat/ChatView';

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-civic-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Se incarca conversatia...</p>
        </div>
      </div>
    );
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
