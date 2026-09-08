/**
 * One chat turn: step detection → system prompt → agentic loop → parse →
 * post-process → response body. Pure orchestration over injected clients.
 */
import { extractProblemContext } from '@m544/chat/guardrails/context';
import { sanitizeMessage } from '@m544/chat/guardrails/injection';
import type { Step } from '@m544/chat/guardrails/steps';
import { getStepGuardrail } from '@m544/chat/prompt/step-guardrails';
import { buildSystemPrompt } from '@m544/chat/prompt/system';
import { buildTools, RAG_SEARCH_TOOL } from '@m544/chat/prompt/tools';
import { createRagSearchExecutor, type SearchInstitutiiFn } from '@m544/chat/rag/tool-executor';
import type { KnownInstitutionLookup } from '@m544/chat/rag/known-institutions';
import { HAIKU_MODEL, type MessagesClient } from '@m544/chat/anthropic/client';
import { normalizeHistory, type ChatMessage } from '@m544/chat/anthropic/messages';
import { runAgenticLoop } from '@m544/chat/anthropic/loop';
import { parseAnthropicResponse, webSearchCount, type ChatSource } from '@m544/chat/anthropic/parse';
import { postProcessResponse } from '@m544/chat/validation/post-process';

export interface TurnInput {
  message: string;
  history: ChatMessage[];
  conversationId?: string | null;
}

export interface TurnDeps {
  client: MessagesClient;
  search?: SearchInstitutiiFn;
  /** Verified addresses from institutii_locale; when set, rag_search hits carry `email_verificat`. */
  lookupInstitution?: KnownInstitutionLookup;
}

export interface ChatResponseBody {
  response: string;
  sources: ChatSource[];
  webSearches: string[];
  model: string;
  conversationId: string | null;
  toolIterations: number;
  webSearchCount: number;
  _debug: { step: Step; context: { ce: string | null; unde: string | null; localitate: string } };
}

export async function runChatTurn(input: TurnInput, deps: TurnDeps): Promise<ChatResponseBody> {
  const sanitizedMessage = sanitizeMessage(input.message);

  const { step, guardrail } = getStepGuardrail(input.history);
  const context = extractProblemContext(input.history);
  const localitate = context.localitate || '';
  console.log(
    `📍 Step: ${step} | Context: CE=${context.ce ? 'YES' : 'NO'} UNDE=${context.unde ? 'YES' : 'NO'} CÂND=${context.cand ? 'YES' : 'NO'} | Localitate: ${localitate || '(none)'}`,
  );

  const { response, iterations } = await runAgenticLoop({
    client: deps.client,
    system: buildSystemPrompt(guardrail),
    tools: buildTools(),
    messages: normalizeHistory(input.history, sanitizedMessage),
    executors: { [RAG_SEARCH_TOOL]: createRagSearchExecutor(localitate || undefined, deps.search, deps.lookupInstitution) },
  });

  const parsed = parseAnthropicResponse(response);
  const { text, sources } = postProcessResponse(parsed, step);

  return {
    response: text,
    sources,
    webSearches: parsed.webSearchQueries,
    model: HAIKU_MODEL,
    conversationId: input.conversationId || null,
    toolIterations: iterations,
    webSearchCount: webSearchCount(response.usage),
    _debug: { step, context: { ce: context.ce, unde: context.unde, localitate } },
  };
}
