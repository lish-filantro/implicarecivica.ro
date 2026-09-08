/**
 * Email classification & data extraction — orchestration.
 *
 * Builds the prompt, calls the chat model in JSON mode (with retry on 429/5xx),
 * and turns the answer into an AnalysisResult. The chat client is injected so
 * tests run without network; the default is the Mistral SDK.
 */
import { Mistral } from '@mistralai/mistralai';
import { optionalEnv, requireEnv } from '@m544/shared/env';
import type { AnalysisResult } from '@m544/pipeline/types';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, type AnalysisInput } from './prompt';
import { parseAnalysisJson, toAnalysisResult } from './parse';
import { withRetry } from './retry';

/**
 * Default analysis model.
 *
 * The strongest model available on the free/experiment tier (mistral-large / medium /
 * small are blocked or have 0 req/min there). Verified 2026-09-08 on the 37 test PDFs:
 * 56/58 checks pass with ministral-14b, the 2 misses being the ambiguous
 * "redirecționare" document. Override per environment with MISTRAL_ANALYSIS_MODEL
 * (e.g. 'mistral-large-latest' on a paid plan).
 */
export const MISTRAL_ANALYSIS_MODEL = 'ministral-14b-latest';

/** Low temperature for deterministic extraction. */
const ANALYSIS_TEMPERATURE = 0.1;

export interface ChatCompletionArgs {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  responseFormat: { type: 'json_object' };
}

export interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/** The slice of the Mistral chat API the analyser needs (`new Mistral(...).chat` satisfies it). */
export interface ChatCompletionClient {
  complete(args: ChatCompletionArgs): Promise<ChatCompletionResponse>;
}

export interface AnalyzeDeps {
  client?: ChatCompletionClient;
  model?: string;
  sleep?: (ms: number) => Promise<void>;
}

let defaultClient: ChatCompletionClient | null = null;

function getDefaultClient(): ChatCompletionClient {
  if (!defaultClient) {
    defaultClient = new Mistral({ apiKey: requireEnv('MISTRAL_API_KEY') }).chat;
  }
  return defaultClient;
}

/** Classify one email (subject + body + OCR text) and extract its structured data. */
export async function analyzeEmailContent(input: AnalysisInput, deps: AnalyzeDeps = {}): Promise<AnalysisResult> {
  const client = deps.client ?? getDefaultClient();
  const model = deps.model ?? optionalEnv('MISTRAL_ANALYSIS_MODEL', MISTRAL_ANALYSIS_MODEL);
  const userMessage = buildAnalysisUserMessage(input);

  const response = await withRetry(
    () =>
      client.complete({
        model,
        messages: [
          { role: 'system', content: EMAIL_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: ANALYSIS_TEMPERATURE,
        responseFormat: { type: 'json_object' },
      }),
    { sleep: deps.sleep },
  );

  const rawContent = response.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string' || rawContent.length === 0) {
    throw new Error('Empty response from Mistral analysis');
  }

  return toAnalysisResult(parseAnalysisJson(rawContent), userMessage);
}
