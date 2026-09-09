'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Message } from '@m544/shared/types/chat';
import * as chatQueries from '@m544/chat/queries.client';

/** The subset of chat queries the hook needs (injectable for tests). */
export type ConversationQueries = Pick<
  typeof chatQueries,
  | 'createConversation'
  | 'loadMessages'
  | 'saveMessage'
  | 'updateConversationTitle'
  | 'updateConversationStep'
  | 'generateTitle'
>;

export interface ConversationRouter {
  replace: (href: string) => void;
}

export interface UseConversationMessagesOptions {
  conversationId?: string | null;
  router: ConversationRouter;
  queries?: ConversationQueries;
}

/** Bookkeeping for one user→bot exchange, produced by `startTurn`. */
export interface Turn {
  convId: string;
  userSeq: number;
  isFirst: boolean;
}

export const WELCOME_TEXT =
  'Bună ziua! Sunt asistentul tău pentru Legea 544/2001. Te pot ajuta să formulezi cereri pentru informații de interes public. Cu ce te pot ajuta astăzi?';

export function nowLabel(): string {
  return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/** Step implied by a bot reply (null = no change). STEP_3 is written when the user confirms the hand-off, never from a reply. */
export function detectStepFromReply(text: string): 'STEP_2' | null {
  return text.includes('INSTITUȚIE_IDENTIFICATĂ') ? 'STEP_2' : null;
}

/**
 * Message list + persistence for one conversation: loads an existing one (or
 * shows the non-persisted welcome message), creates the conversation on the
 * first message, saves messages with sequence numbers, sets title and step.
 */
export function useConversationMessages({
  conversationId: initialConvId,
  router,
  queries = chatQueries,
}: UseConversationMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConvId || null);
  const [isLoading, setIsLoading] = useState(false);

  // Derive conversationHistory from messages
  // Skip only the initial welcome message (first bot message in a new conversation)
  const conversationHistory = useMemo(() => {
    const startIdx = messages.length > 0 && messages[0].sender === 'bot' && !messages[0].id ? 1 : 0;
    return messages.slice(startIdx).map((m) => ({
      role: m.sender === 'user' ? 'user' : ('assistant' as string),
      content: m.text,
    }));
  }, [messages]);

  // Load existing conversation or show welcome
  useEffect(() => {
    if (initialConvId) {
      setIsLoading(true);
      queries
        .loadMessages(initialConvId)
        .then((msgs) => {
          setMessages(msgs);
          setConversationId(initialConvId);
        })
        .catch((err) => {
          console.error('Failed to load conversation:', err);
          router.replace('/chat');
        })
        .finally(() => setIsLoading(false));
    } else {
      // New conversation - show welcome message (not persisted)
      setMessages([{ sender: 'bot', text: WELCOME_TEXT, time: nowLabel() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConvId, router]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /** Creates the conversation on the first message and persists the user message. */
  const startTurn = useCallback(
    async (userMsg: Message): Promise<Turn> => {
      let convId = conversationId;
      if (!convId) {
        const conv = await queries.createConversation(queries.generateTitle(userMsg.text));
        convId = conv.id;
        setConversationId(convId);
        // Update URL without triggering Next.js navigation (which would remount and lose state)
        window.history.replaceState(null, '', `/chat/${convId}`);
      }

      // Calculate sequence number (count only persisted messages + this one)
      const persistedCount = messages.filter((m) => m.id).length;
      const userSeq = persistedCount + 1;

      // Save user message (fire-and-forget)
      queries
        .saveMessage(convId, userMsg, userSeq)
        .catch((err) => console.error('Failed to save user message:', err));

      return { convId, userSeq, isFirst: persistedCount === 0 };
    },
    [conversationId, messages, queries],
  );

  /** Appends + persists the bot reply, then updates title (first turn) and step. */
  const completeTurn = useCallback(
    (turn: Turn, botMsg: Message, userText: string) => {
      setMessages((prev) => [...prev, botMsg]);

      // Save bot message (fire-and-forget)
      queries
        .saveMessage(turn.convId, botMsg, turn.userSeq + 1)
        .catch((err) => console.error('Failed to save bot message:', err));

      // Update title if this was the first message
      if (turn.isFirst) {
        queries.updateConversationTitle(turn.convId, queries.generateTitle(userText)).catch(() => {});
      }

      // Detect step from response and update
      const step = detectStepFromReply(botMsg.text);
      if (step) {
        queries.updateConversationStep(turn.convId, step).catch(() => {});
      }
    },
    [queries],
  );

  const removeErrorMessages = useCallback(() => {
    setMessages((prev) => prev.filter((m) => !m.isError));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    conversationHistory,
    appendMessage,
    startTurn,
    completeTurn,
    removeErrorMessages,
    reset,
  };
}
