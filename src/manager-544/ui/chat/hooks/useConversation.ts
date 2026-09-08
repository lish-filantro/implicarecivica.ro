'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Message } from '@m544/shared/types/chat';
import { useTypingIndicator } from './useTypingIndicator';
import { useChatApi, type FetchLike } from './useChatApi';
import {
  useConversationMessages,
  nowLabel,
  type ConversationQueries,
} from './useConversationMessages';
import { useInstitutionExtraction } from './useInstitutionExtraction';

export type { InstitutionData } from './useInstitutionExtraction';

export interface UseConversationOptions {
  conversationId?: string | null;
  /** Test seams; production uses the real fetch and Supabase queries. */
  fetchImpl?: FetchLike;
  queries?: ConversationQueries;
}

/** Number of history entries (including the new message) sent to the API. */
export const HISTORY_WINDOW = 10;

export const SERVER_ERROR_TEXT = '❌ Eroare la comunicarea cu serverul.';

/**
 * Chat screen state: messages, input, typing indicator, AI status, send/retry.
 * Composes the transport (useChatApi), persistence (useConversationMessages)
 * and the STEP_2 hand-off (useInstitutionExtraction).
 */
export function useConversation({
  conversationId: initialConvId,
  fetchImpl,
  queries,
}: UseConversationOptions = {}) {
  const router = useRouter();
  const [inputMessage, setInputMessage] = useState('');
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  const { isTyping, startTyping, stopTyping } = useTypingIndicator();
  const { aiStatus, sendChatMessage } = useChatApi({ fetchImpl });
  const {
    messages,
    conversationId,
    isLoading,
    conversationHistory,
    appendMessage,
    startTurn,
    completeTurn,
    removeErrorMessages,
    reset,
  } = useConversationMessages({ conversationId: initialConvId, router, queries });

  const extractInstitutionData = useInstitutionExtraction(
    messages,
    conversationHistory,
    conversationId,
  );

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isTyping) return;

    const text = inputMessage;
    setInputMessage('');
    setFailedMessage(null);

    // User message (optimistic)
    const userMsg: Message = { sender: 'user', text, time: nowLabel() };
    appendMessage(userMsg);

    startTyping('Se gândește...');

    try {
      const turn = await startTurn(userMsg);

      const data = await sendChatMessage({
        message: text,
        conversationHistory: [...conversationHistory, { role: 'user', content: text }].slice(
          -HISTORY_WINDOW,
        ),
        conversationId: turn.convId,
      });

      const botMsg: Message = {
        sender: 'bot',
        text: data.response,
        time: nowLabel(),
        webSources: data.sources,
        webSearches: data.webSearches,
      };

      completeTurn(turn, botMsg, text);
    } catch (error) {
      console.error('Error sending message:', error);
      setFailedMessage(text);
      appendMessage({ sender: 'bot', text: SERVER_ERROR_TEXT, time: nowLabel(), isError: true });
    } finally {
      stopTyping();
    }
  }, [
    inputMessage,
    isTyping,
    conversationHistory,
    appendMessage,
    startTurn,
    completeTurn,
    sendChatMessage,
    startTyping,
    stopTyping,
  ]);

  const retryLastMessage = useCallback(() => {
    if (!failedMessage) return;
    // Remove the error message and the failed user message
    removeErrorMessages();
    setInputMessage(failedMessage);
    setFailedMessage(null);
  }, [failedMessage, removeErrorMessages]);

  const startNewConversation = useCallback(() => {
    reset();
    setInputMessage('');
    router.push('/chat');
  }, [reset, router]);

  return {
    messages,
    inputMessage,
    setInputMessage,
    sendMessage,
    isTyping,
    aiStatus,
    isLoading,
    conversationId,
    startNewConversation,
    extractInstitutionData,
    failedMessage,
    retryLastMessage,
  };
}
