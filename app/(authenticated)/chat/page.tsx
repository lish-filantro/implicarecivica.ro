'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useConversation } from '@/lib/hooks/useConversation';
import ChatView from '@/components/chat/ChatView';

export default function NewChatPage() {
  const router = useRouter();
  const {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    isTyping,
    aiStatus,
    extractInstitutionData,
  } = useConversation();

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
    />
  );
}
