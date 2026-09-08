/**
 * pipeline/analysis — public API.
 * Import from '@m544/pipeline/analysis'; the sub-modules are implementation detail.
 */
export {
  analyzeEmailContent,
  createAnalysisClient,
  resolveModel,
  type AnalyzeDeps,
  type AnalysisClientFactories,
} from './analyze';
export { ANALYSIS_PROVIDERS, resolveProvider, type AnalysisClient, type AnalysisProvider } from './client';
export {
  createAnthropicAnalysisClient,
  HAIKU_ANALYSIS_MODEL,
  ANTHROPIC_MAX_TOKENS,
  type AnthropicAnalysisOptions,
  type AnthropicMessagesSdk,
} from './providers/anthropic';
export {
  createMistralAnalysisClient,
  MISTRAL_ANALYSIS_MODEL,
  type ChatCompletionArgs,
  type ChatCompletionClient,
  type ChatCompletionResponse,
  type MistralAnalysisOptions,
} from './providers/mistral';
export { EMAIL_ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, type AnalysisInput } from './prompt';
export { validateRegistrationNumber } from './registration';
export {
  AnalysisParseError,
  parseAnalysisJson,
  normalizeCategory,
  parseAnswerSummary,
  toAnalysisResult,
} from './parse';
export { withRetry, errorStatus, isRetryableStatus, type RetryOptions } from './retry';
export type { AnalysisResult } from '@m544/pipeline/types';
