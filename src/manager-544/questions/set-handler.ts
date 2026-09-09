/**
 * POST /api/questions/generate-set
 *
 * One call on the chat model (Sonnet, `chatModel()`) that returns 5 questions
 * for each of the 5 categories, built from the whole conversation (or from a
 * session's institution + already-sent questions). Context is loaded
 * server-side with the user's client; the body only carries an id.
 *
 *   body { conversationId } | { sessionId } · ?refresh=1 bypasses the cache
 *   200 { model, categories, cached } · 400 body · 401 no session
 *   404 conversation/session not found · 503 key not configured
 *   502 Anthropic 401 · 429 Anthropic 429 · 500 other (or no questions produced)
 *
 * For a conversation the set is cached on conversations.handoff.questions.
 */
import type { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { createServerClient } from '@m544/shared/db/clients';
import { chatModel, createAnthropicClient, type MessagesClient } from '@m544/chat/anthropic/client';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import type { QuestionSet } from '@m544/shared/types/questions';
import {
  EMIT_QUESTIONS_TOOL,
  QUESTIONS_PER_CATEGORY,
  buildSetSystemPrompt,
  buildSetUserPrompt,
  countQuestions,
  parseQuestionSet,
} from './set-prompt';
import { loadConversationContext, loadSessionContext, type QueryClient, type SetContext } from './set-context';

export type SetClient = AuthClient & QueryClient;

export interface GenerateSetDeps {
  createClient: () => Promise<SetClient>;
  /** null when ANTHROPIC_API_KEY is not configured (→ 503). */
  createAnthropic: () => MessagesClient | null;
  /** Defaults to the chat model. */
  model?: () => string;
}

export interface GenerateSetResponse {
  model: string;
  categories: QuestionSet;
  cached: boolean;
}

const bodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
});

const MAX_TOKENS = 4096;
// No `temperature`: Sonnet 5 rejects it (400 "`temperature` is deprecated for this model").

export const MISSING_ID_MESSAGE = 'conversationId sau sessionId este obligatoriu';
export const NO_QUESTIONS_MESSAGE = 'Modelul nu a produs întrebări. Reîncearcă.';

function toolInput(response: Anthropic.Messages.Message): unknown {
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === EMIT_QUESTIONS_TOOL.name) return block.input;
  }
  return null;
}

/** Surface auth/rate-limit problems instead of a silent empty set (same mapping as /generate). */
function mapProviderError(error: unknown) {
  const err = error as { status?: number; message?: string };
  console.error('[questions/generate-set] Error:', err.message || error);
  if (err.status === 401) return httpError(502, 'Cheia Anthropic este invalidă');
  if (err.status === 429) return httpError(429, 'Limită de rată atinsă. Reîncearcă în câteva secunde.');
  return httpError(500, 'Eroare la generarea întrebărilor');
}

async function cacheOnConversation(
  sb: QueryClient,
  conversationId: string,
  handoff: ConversationHandoff,
  questions: QuestionSet,
  model: string,
): Promise<void> {
  const { error } = await sb
    .from('conversations')
    .update({ handoff: { ...handoff, questions, questionsModel: model } })
    .eq('id', conversationId);
  if (error) console.error('[questions/generate-set] cache write failed:', error.message);
}

export function createGenerateSetHandler(getDeps: () => GenerateSetDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;

    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) return body.response;
    const { conversationId, sessionId } = body.data;
    if (!conversationId && !sessionId) return httpError(400, MISSING_ID_MESSAGE);

    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    const model = (deps.model ?? chatModel)();
    const sb = guard.supabase;
    const userId = guard.user.id;

    let ctx: SetContext;
    let handoff: ConversationHandoff | null = null;
    if (conversationId) {
      const loaded = await loadConversationContext(sb, conversationId, userId);
      if (!loaded) return httpError(404, 'Conversația nu a fost găsită');
      ({ ctx, handoff } = loaded);
      if (handoff?.questions && !refresh) {
        return json<GenerateSetResponse>({ model: handoff.questionsModel ?? model, categories: handoff.questions, cached: true });
      }
    } else {
      const loaded = await loadSessionContext(sb, sessionId as string, userId);
      if (!loaded) return httpError(404, 'Sesiunea nu a fost găsită');
      ctx = loaded;
    }

    const client = deps.createAnthropic();
    if (!client) return httpError(503, 'Serviciul de generare nu este configurat');

    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: buildSetSystemPrompt(),
        tools: [EMIT_QUESTIONS_TOOL],
        tool_choice: { type: 'tool', name: EMIT_QUESTIONS_TOOL.name },
        messages: [{ role: 'user', content: buildSetUserPrompt(ctx) }],
      });
      const categories = parseQuestionSet(toolInput(response), QUESTIONS_PER_CATEGORY);
      if (countQuestions(categories) === 0) {
        console.warn('[questions/generate-set] Empty set from the model', { conversationId, sessionId });
        return httpError(500, NO_QUESTIONS_MESSAGE);
      }
      if (conversationId && handoff) await cacheOnConversation(sb, conversationId, handoff, categories, model);
      return json<GenerateSetResponse>({ model, categories, cached: false });
    } catch (error) {
      return mapProviderError(error);
    }
  }, 'questions/generate-set');
}

export function createGenerateSetDeps(): GenerateSetDeps {
  return { createClient: createServerClient, createAnthropic: createAnthropicClient };
}
