/**
 * pipeline/analysis — public API.
 * Import from '@m544/pipeline/analysis'; the sub-modules are implementation detail.
 */
export {
  analyzeEmailContent,
  MISTRAL_ANALYSIS_MODEL,
  type AnalyzeDeps,
  type ChatCompletionArgs,
  type ChatCompletionClient,
  type ChatCompletionResponse,
} from './analyze';
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
