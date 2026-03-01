'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import type { Message } from '@/lib/types/chat';
import {
  createConversation,
  loadMessages,
  saveMessage,
  updateConversationTitle,
  updateConversationStep,
  generateTitle,
} from '@/lib/supabase/chat-queries';
import { extractProblemContext } from '@/lib/guardrails';

interface InstitutionData {
  institutionName: string;
  institutionEmail: string;
  problemContext: { ce: string; unde: string; cand: string };
  conversationId: string | null;
}

interface UseConversationOptions {
  conversationId?: string | null;
}

export function useConversation({ conversationId: initialConvId }: UseConversationOptions = {}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(initialConvId || null);
  const [aiStatus, setAiStatus] = useState<'loading' | 'configured' | 'mock'>('loading');
  const [isLoading, setIsLoading] = useState(false);

  const { isTyping, startTyping, stopTyping } = useTypingIndicator();

  // Derive conversationHistory from messages (skip welcome message which has no id)
  const conversationHistory = useMemo(
    () =>
      messages
        .filter((m) => m.id) // only persisted messages
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : ('assistant' as string),
          content: m.text,
        })),
    [messages],
  );

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const chatEndpoint = process.env.NEXT_PUBLIC_CHAT_ENDPOINT || '/api/chat-haiku';
        const response = await fetch(chatEndpoint);
        const data = await response.json();
        setAiStatus(data.anthropicConfigured || data.aiConfigured ? 'configured' : 'mock');
      } catch {
        setAiStatus('mock');
      }
    };
    checkAIStatus();
  }, []);

  // Load existing conversation or show welcome
  useEffect(() => {
    if (initialConvId) {
      setIsLoading(true);
      loadMessages(initialConvId)
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
      setMessages([
        {
          sender: 'bot',
          text: 'Bună ziua! Sunt asistentul tău pentru Legea 544/2001. Te pot ajuta să formulezi cereri pentru informații de interes public. Cu ce te pot ajuta astăzi?',
          time: new Date().toLocaleTimeString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }
  }, [initialConvId, router]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isTyping) return;

    const text = inputMessage;
    setInputMessage('');

    const now = new Date().toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // User message (optimistic)
    const userMsg: Message = { sender: 'user', text, time: now };
    setMessages((prev) => [...prev, userMsg]);

    startTyping('Se gândește...');

    try {
      // Create conversation on first message
      let convId = conversationId;
      if (!convId) {
        const conv = await createConversation(generateTitle(text));
        convId = conv.id;
        setConversationId(convId);
        // Update URL without triggering Next.js navigation (which would remount and lose state)
        window.history.replaceState(null, '', `/chat/${convId}`);
      }

      // Calculate sequence number (count only persisted messages + this one)
      const persistedCount = messages.filter((m) => m.id).length;
      const userSeq = persistedCount + 1;

      // Save user message (fire-and-forget)
      saveMessage(convId, userMsg, userSeq).catch((err) =>
        console.error('Failed to save user message:', err),
      );

      // Call API
      const chatEndpoint = process.env.NEXT_PUBLIC_CHAT_ENDPOINT || '/api/chat-haiku';
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: [
            ...conversationHistory,
            { role: 'user', content: text },
          ].slice(-10),
          conversationId: convId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.response?.trim()) {
        throw new Error('Răspuns gol de la API');
      }

      const botMsg: Message = {
        sender: 'bot',
        text: data.response,
        time: new Date().toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        webSources: data.sources || [],
        webSearches: data.webSearches || [],
      };

      setMessages((prev) => [...prev, botMsg]);

      // Save bot message (fire-and-forget)
      const botSeq = userSeq + 1;
      saveMessage(convId, botMsg, botSeq).catch((err) =>
        console.error('Failed to save bot message:', err),
      );

      // Update title if this was the first message
      if (persistedCount === 0) {
        updateConversationTitle(convId, generateTitle(text)).catch(() => {});
      }

      // Detect step from response and update
      if (data.response.includes('INSTITUȚIE_IDENTIFICATĂ')) {
        updateConversationStep(convId, 'STEP_2').catch(() => {});
      } else if (data.response.includes('ÎNTREBĂRI_STRATEGICE') || data.response.includes('FINANCIAR')) {
        updateConversationStep(convId, 'STEP_3').catch(() => {});
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '❌ Ne cerem scuze, a apărut o eroare la comunicarea cu serverul. Te rugăm să încerci din nou.',
          time: new Date().toLocaleTimeString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      stopTyping();
    }
  }, [inputMessage, isTyping, conversationId, conversationHistory, messages, startTyping, stopTyping]);

  const extractInstitutionData = useCallback((): InstitutionData | null => {
    // Find the last bot message with INSTITUȚIE_IDENTIFICATĂ
    const institutionMsg = [...messages].reverse().find(
      (m) => m.sender === 'bot' && m.text.includes('INSTITUȚIE_IDENTIFICATĂ'),
    );
    if (!institutionMsg) return null;

    // Extract institution name
    const nameMatch = institutionMsg.text.match(
      /INSTITUȚIE_IDENTIFICATĂ[:\s]+(?:Tip:)?\s*(.+?)(?:\n|📧|🔗|\/\s|$)/i,
    );
    const institutionName = nameMatch ? nameMatch[1].replace(/\*+/g, '').trim() : '';

    // Extract email
    const emailMatch = institutionMsg.text.match(
      /Email identificat:\*?\*?\s*([^\s\n]+@[^\s\n]+)/i,
    );
    const institutionEmail = emailMatch ? emailMatch[1].trim() : '';

    if (!institutionName) return null;

    // Extract problem context from conversation history
    const ctx = extractProblemContext(conversationHistory);

    return {
      institutionName,
      institutionEmail,
      problemContext: {
        ce: ctx.ce || '',
        unde: ctx.unde || '',
        cand: ctx.cand || '',
      },
      conversationId,
    };
  }, [messages, conversationHistory, conversationId]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setInputMessage('');
    router.push('/chat');
  }, [router]);

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
  };
}
