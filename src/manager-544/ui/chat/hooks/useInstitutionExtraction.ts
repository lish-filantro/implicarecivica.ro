'use client';

import { useCallback } from 'react';
import type { Message } from '@m544/shared/types/chat';
import { extractProblemContext, type HistoryMessage } from '@m544/chat/guardrails/context';
import { extractEmails } from '@m544/chat/validation/email';

export interface InstitutionData {
  institutionName: string;
  institutionEmail: string;
  problemContext: { ce: string; unde: string; cand: string };
  conversationId: string | null;
}

const INSTITUTION_MARKER = 'INSTITUȚIE_IDENTIFICATĂ';
const NAME_PATTERN = /INSTITUȚIE_IDENTIFICATĂ[:\s]+(?:Tip:)?\s*(.+?)(?:\n|📧|🔗|\/\s|$)/i;

/**
 * Data handed to the request wizard once the user confirms the institution:
 * name and email from the last STEP_2 bot message, problem context from the history.
 * Returns null when no bot message carries the marker or the name cannot be read.
 */
export function extractInstitutionData(
  messages: Message[],
  conversationHistory: HistoryMessage[],
  conversationId: string | null,
): InstitutionData | null {
  // Find the last bot message with INSTITUȚIE_IDENTIFICATĂ
  const institutionMsg = [...messages]
    .reverse()
    .find((m) => m.sender === 'bot' && m.text.includes(INSTITUTION_MARKER));
  if (!institutionMsg) return null;

  // Extract institution name
  const nameMatch = institutionMsg.text.match(NAME_PATTERN);
  const institutionName = nameMatch ? nameMatch[1].replace(/\*+/g, '').trim() : '';

  // Extract email — bot uses varying formats ("Email identificat:", "Email pentru cereri:", etc.)
  // Use generic email extractor to find the first institutional email in the message
  const foundEmails = extractEmails(institutionMsg.text);
  const institutionEmail = foundEmails.length > 0 ? foundEmails[0] : '';

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
}

/** Memoised `extractInstitutionData` bound to the current conversation state. */
export function useInstitutionExtraction(
  messages: Message[],
  conversationHistory: HistoryMessage[],
  conversationId: string | null,
) {
  return useCallback(
    () => extractInstitutionData(messages, conversationHistory, conversationId),
    [messages, conversationHistory, conversationId],
  );
}
