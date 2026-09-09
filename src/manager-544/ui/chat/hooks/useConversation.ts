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
import { useHandoff, type HandoffQueries } from './useHandoff';

export interface UseConversationOptions {
  conversationId?: string | null;
  /** Test seams; production uses the real fetch and Supabase queries. */
  fetchImpl?: FetchLike;
  queries?: ConversationQueries & Partial<HandoffQueries>;
}

/** Number of history entries (including the new message) sent to the API. */
export const HISTORY_WINDOW = 10;

export const SERVER_ERROR_TEXT = '❌ Eroare la comunicarea cu serverul.';

/** Sent on "Caută din nou": the assistant re-runs the institution identification. */
export const REJECT_INSTITUTION_TEXT =
  'Nu, instituția identificată nu este cea corectă. Te rog identifică altă instituție responsabilă.';

/**
 * Chat screen state: messages, input, typing indicator, AI status, send/retry,
 * and the hand-off to the request wizard. Composes the transport (useChatApi),
 * persistence (useConversationMessages) and the hand-off (useHandoff).
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

  const handoffQueries =
    queries?.getConversationHandoff && queries.updateConversationHandoff
      ? (queries as HandoffQueries)
      : undefined;
  const { handoff, recordInstitution, confirm: confirmHandoff } = useHandoff({
    conversationId,
    queries: handoffQueries,
  });

  const sendText = useCallback(
    async (rawText: string) => {
      if (!rawText.trim() || isTyping) return;

      const text = rawText;
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

        if (data.institution) {
          recordInstitution(
            data.institution,
            [...conversationHistory, { role: 'user', content: text }, { role: 'assistant', content: data.response }],
            turn.convId,
          );
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setFailedMessage(text);
        appendMessage({ sender: 'bot', text: SERVER_ERROR_TEXT, time: nowLabel(), isError: true });
      } finally {
        stopTyping();
      }
    },
    [
      isTyping,
      conversationHistory,
      appendMessage,
      startTurn,
      completeTurn,
      sendChatMessage,
      startTyping,
      stopTyping,
      recordInstitution,
    ],
  );

  const sendMessage = useCallback(() => sendText(inputMessage), [sendText, inputMessage]);

  /** "Caută din nou" on the institution card. */
  const rejectInstitution = useCallback(() => sendText(REJECT_INSTITUTION_TEXT), [sendText]);

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
    handoff,
    confirmHandoff,
    rejectInstitution,
    failedMessage,
    retryLastMessage,
  };
}
