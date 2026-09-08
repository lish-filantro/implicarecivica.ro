/**
 * Provider-neutral contract for the email classifier.
 *
 * The analyser only needs "system prompt + user message in, raw text out";
 * `providers/anthropic.ts` and `providers/mistral.ts` adapt the two SDKs to it,
 * and tests inject a scripted fake.
 */

export interface AnalysisClient {
  complete(system: string, user: string): Promise<string>;
}

export const ANALYSIS_PROVIDERS = ['anthropic', 'mistral'] as const;
export type AnalysisProvider = (typeof ANALYSIS_PROVIDERS)[number];

const DEFAULT_PROVIDER: AnalysisProvider = 'anthropic';

function isProvider(value: string): value is AnalysisProvider {
  return (ANALYSIS_PROVIDERS as readonly string[]).includes(value);
}

/** Parse an ANALYSIS_PROVIDER value; blank → anthropic, unknown → clear Error. */
export function resolveProvider(raw: string | undefined): AnalysisProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (value.length === 0) return DEFAULT_PROVIDER;
  if (isProvider(value)) return value;
  throw new Error(`Unsupported ANALYSIS_PROVIDER '${value}' (expected 'anthropic' or 'mistral')`);
}
