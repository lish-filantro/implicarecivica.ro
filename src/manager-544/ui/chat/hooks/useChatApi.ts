'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatInstitution } from '@m544/shared/types/chat';

/** Request body accepted by POST /api/chat-haiku. */
export interface ChatApiRequest {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  conversationId: string | null;
}

/** Successful reply from the chat API (non-empty `response`). */
export interface ChatApiReply {
  response: string;
  sources: Array<{ url: string; title: string; description?: string }>;
  webSearches: string[];
  /** The institution identified in this reply (STEP_2), or null. */
  institution: ChatInstitution | null;
}

export type AiStatus = 'loading' | 'configured' | 'mock';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface UseChatApiOptions {
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: FetchLike;
}

/** Endpoint is inlined at build time from NEXT_PUBLIC_CHAT_ENDPOINT (defaults to the Haiku route). */
export function getChatEndpoint(): string {
  return process.env.NEXT_PUBLIC_CHAT_ENDPOINT || '/api/chat-haiku';
}

interface HealthPayload {
  anthropicConfigured?: boolean;
  aiConfigured?: boolean;
}

interface ReplyPayload {
  response?: string;
  sources?: ChatApiReply['sources'];
  webSearches?: string[];
  institution?: ChatInstitution | null;
}

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Transport layer of the chat: health check on mount + one POST per turn.
 * Any non-2xx status (including 401 when the session expired) and an empty
 * reply are surfaced as thrown errors so the caller shows the error bubble.
 */
export function useChatApi({ fetchImpl = defaultFetch }: UseChatApiOptions = {}) {
  const [aiStatus, setAiStatus] = useState<AiStatus>('loading');

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetchImpl(getChatEndpoint());
        const data = (await response.json()) as HealthPayload;
        setAiStatus(data.anthropicConfigured || data.aiConfigured ? 'configured' : 'mock');
      } catch {
        setAiStatus('mock');
      }
    };
    checkAIStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChatMessage = useCallback(
    async (body: ChatApiRequest): Promise<ChatApiReply> => {
      const response = await fetchImpl(getChatEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as ReplyPayload;

      if (!data.response?.trim()) {
        throw new Error('Răspuns gol de la API');
      }

      return {
        response: data.response,
        sources: data.sources || [],
        webSearches: data.webSearches || [],
        institution: data.institution ?? null,
      };
    },
    [fetchImpl],
  );

  return { aiStatus, sendChatMessage };
}
