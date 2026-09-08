/**
 * Email classification & data extraction — orchestration.
 *
 * Builds the prompt, calls the selected AI provider (with retry on 429/5xx) and turns
 * the answer into an AnalysisResult. The client is injected so tests run without
 * network; by default the provider comes from ANALYSIS_PROVIDER (anthropic | mistral,
 * default anthropic) and the model from ANALYSIS_MODEL (or the provider default).
 */
import { optionalEnv } from '@m544/shared/env';
import type { AnalysisResult } from '@m544/pipeline/types';
import { resolveProvider, type AnalysisClient, type AnalysisProvider } from './client';
import { createAnthropicAnalysisClient, HAIKU_ANALYSIS_MODEL } from './providers/anthropic';
import { createMistralAnalysisClient, MISTRAL_ANALYSIS_MODEL } from './providers/mistral';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, type AnalysisInput } from './prompt';
import { parseAnalysisJson, toAnalysisResult } from './parse';
import { withRetry } from './retry';

export { HAIKU_ANALYSIS_MODEL, MISTRAL_ANALYSIS_MODEL, resolveProvider };
export type { AnalysisClient, AnalysisProvider };

export interface AnalyzeDeps {
  /** Ready-made client; when given, `provider`/`model` only label errors. */
  client?: AnalysisClient;
  sleep?: (ms: number) => Promise<void>;
  /** Overrides ANALYSIS_PROVIDER. */
  provider?: AnalysisProvider;
  /** Overrides ANALYSIS_MODEL / the provider default. */
  model?: string;
}

/** One factory per provider; injected in tests, real SDK clients in production. */
export interface AnalysisClientFactories {
  anthropic: (opts: { model?: string }) => AnalysisClient;
  mistral: (opts: { model?: string }) => AnalysisClient;
}

const DEFAULT_FACTORIES: AnalysisClientFactories = {
  anthropic: createAnthropicAnalysisClient,
  mistral: createMistralAnalysisClient,
};

/**
 * Model for a provider: explicit override, then ANALYSIS_MODEL, then (mistral only)
 * the legacy MISTRAL_ANALYSIS_MODEL; undefined means "the provider's default".
 */
export function resolveModel(provider: AnalysisProvider, override?: string): string | undefined {
  if (override) return override;
  const generic = optionalEnv('ANALYSIS_MODEL');
  if (generic) return generic;
  return provider === 'mistral' ? optionalEnv('MISTRAL_ANALYSIS_MODEL') : undefined;
}

/** Build the production client for the selected provider (throws EnvError when its key is missing). */
export function createAnalysisClient(
  deps: Pick<AnalyzeDeps, 'provider' | 'model'>,
  factories: AnalysisClientFactories = DEFAULT_FACTORIES,
): AnalysisClient {
  const provider = deps.provider ?? resolveProvider(optionalEnv('ANALYSIS_PROVIDER'));
  return factories[provider]({ model: resolveModel(provider, deps.model) });
}

/** Injected client (labelled by deps.provider or 'custom'), else the provider selected from deps/env. */
function selectClient(deps: AnalyzeDeps): { client: AnalysisClient; label: string } {
  if (deps.client) return { client: deps.client, label: deps.provider ?? 'custom' };
  const provider = deps.provider ?? resolveProvider(optionalEnv('ANALYSIS_PROVIDER'));
  return { client: createAnalysisClient({ provider, model: deps.model }), label: provider };
}

/** Classify one email (subject + body + OCR text) and extract its structured data. */
export async function analyzeEmailContent(input: AnalysisInput, deps: AnalyzeDeps = {}): Promise<AnalysisResult> {
  const { client, label } = selectClient(deps);
  const userMessage = buildAnalysisUserMessage(input);

  const raw = await withRetry(() => client.complete(EMAIL_ANALYSIS_SYSTEM_PROMPT, userMessage), { sleep: deps.sleep });
  if (raw.length === 0) {
    throw new Error(`Empty response from ${label} analysis`);
  }

  return toAnalysisResult(parseAnalysisJson(raw), userMessage);
}
