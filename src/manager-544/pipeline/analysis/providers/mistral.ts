/**
 * Mistral (JSON mode) as the email classifier — the original adapter, kept as the
 * alternative to Claude Haiku (ANALYSIS_PROVIDER=mistral).
 */
import { Mistral } from '@mistralai/mistralai';
import { requireEnv } from '@m544/shared/env';
import type { AnalysisClient } from '../client';

/**
 * Default Mistral analysis model.
 *
 * The strongest model available on the free/experiment tier (mistral-large / medium /
 * small are blocked or have 0 req/min there). Verified 2026-09-08 on the 37 test PDFs:
 * 56/58 checks pass with ministral-14b, the 2 misses being the ambiguous
 * "redirecționare" document. Override with ANALYSIS_MODEL (or the legacy
 * MISTRAL_ANALYSIS_MODEL), e.g. 'mistral-large-latest' on a paid plan.
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

export interface MistralAnalysisOptions {
  /** Explicit key; defaults to MISTRAL_API_KEY. Ignored when `sdk` is given. */
  apiKey?: string;
  /** Defaults to MISTRAL_ANALYSIS_MODEL. */
  model?: string;
  /** Injected chat SDK (tests); defaults to a real client. */
  sdk?: ChatCompletionClient;
}

export function createMistralAnalysisClient(opts: MistralAnalysisOptions = {}): AnalysisClient {
  const model = opts.model ?? MISTRAL_ANALYSIS_MODEL;
  const sdk = opts.sdk ?? new Mistral({ apiKey: opts.apiKey ?? requireEnv('MISTRAL_API_KEY') }).chat;

  return {
    async complete(system, user) {
      const response = await sdk.complete({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: ANALYSIS_TEMPERATURE,
        responseFormat: { type: 'json_object' },
      });
      const content = response.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    },
  };
}
