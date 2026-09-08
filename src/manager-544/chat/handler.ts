/**
 * Route handlers for the chat.
 *
 *   POST /api/chat-haiku  { message, conversationHistory?, conversationId? }
 *   GET  /api/chat-haiku  health
 *
 * Requires a logged-in user (only they may spend Anthropic tokens / web searches).
 * Input guards: empty → 400, too long → 400, prompt injection / off-topic →
 * canned 200 answers without calling the model; 60 user messages per UTC day
 * → 429 (checked after the guards, before the model, when `deps.usage` is set).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { MAX_MESSAGE_LENGTH, isPromptInjectionAttempt } from '@m544/chat/guardrails/injection';
import { isOffTopic } from '@m544/chat/guardrails/off-topic';
import { chatModel, isAnthropicConfigured, type MessagesClient } from '@m544/chat/anthropic/client';
import { anthropicErrorResponse } from '@m544/chat/anthropic/errors';
import type { SearchInstitutiiFn } from '@m544/chat/rag/tool-executor';
import type { KnownInstitutionLookup } from '@m544/chat/rag/known-institutions';
import { CHAT_DAILY_LIMIT, checkChatLimit, type ChatUsageCounter } from '@m544/chat/rate-limit';
import { runChatTurn } from './turn';

export interface ChatDeps {
  createClient: () => Promise<AuthClient>;
  createAnthropic: () => MessagesClient | null;
  /** Override of the institution search (tests); defaults to the local knowledge base. */
  search?: SearchInstitutiiFn;
  /** Verified 544 addresses (institutii_locale) added to rag_search results; absent → no enrichment. */
  lookupInstitution?: KnownInstitutionLookup;
  /** Daily quota counter; absent → no limit (tests, smoke). */
  usage?: ChatUsageCounter;
}

export const LIMIT_REACHED_MESSAGE = `Ai atins limita zilnică de ${CHAT_DAILY_LIMIT} de mesaje. Revino mâine.`;

export const CANNED_INJECTION_RESPONSE =
  'Sunt specializat doar pe Legea 544/2001. Te rog sa formulezi o intrebare legata de accesul la informatii de interes public.';
export const CANNED_OFF_TOPIC_RESPONSE =
  'Sunt specializat doar pe Legea 544/2001. Cu ce te pot ajuta in legatura cu formularea unei cereri?';

const chatBodySchema = z.object({
  message: z.string().optional(),
  conversationHistory: z
    .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() }))
    .optional(),
  conversationId: z.string().nullish(),
});

function canned(response: string) {
  return json({ response, sources: [], webSearches: [], model: chatModel() });
}

export function createChatHandler(getDeps: () => ChatDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;

    const body = await parseJsonBody(request, chatBodySchema);
    if (!body.ok) return body.response;
    const { message = '', conversationHistory = [], conversationId } = body.data;

    if (!message.trim()) return httpError(400, 'Mesajul este obligatoriu');
    if (message.length > MAX_MESSAGE_LENGTH) {
      return httpError(400, `Mesajul depaseste limita de ${MAX_MESSAGE_LENGTH} caractere`);
    }
    if (isPromptInjectionAttempt(message)) {
      console.warn('PROMPT INJECTION BLOCKED');
      return canned(CANNED_INJECTION_RESPONSE);
    }
    if (isOffTopic(message)) return canned(CANNED_OFF_TOPIC_RESPONSE);

    if (deps.usage) {
      const quota = await checkChatLimit(guard.user.id, deps.usage);
      if (!quota.ok) return httpError(429, LIMIT_REACHED_MESSAGE, { limit: quota.limit, used: quota.used });
    }

    const client = deps.createAnthropic();
    if (!client) {
      return httpError(500, 'ANTHROPIC_API_KEY nu este configurat', { details: 'Adauga ANTHROPIC_API_KEY in .env.local' });
    }

    try {
      return json(
        await runChatTurn(
          { message, history: conversationHistory, conversationId },
          { client, search: deps.search, lookupInstitution: deps.lookupInstitution },
        ),
      );
    } catch (err) {
      const mapped = anthropicErrorResponse(err);
      if (mapped) return mapped;
      throw err;
    }
  }, 'chat-haiku');
}

export function createChatHealthHandler(configured: () => boolean = isAnthropicConfigured) {
  return () =>
    json({
      status: 'online',
      model: chatModel(),
      anthropicConfigured: configured(),
      ragBackend: 'local-institutii-index',
      tools: ['rag_search (custom)', 'web_search (server-side Anthropic)', 'web_fetch (server-side Anthropic)'],
      guardrailsEnabled: true,
    });
}
