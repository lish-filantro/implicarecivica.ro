/**
 * Chat guardrails: step detection, problem-context extraction, prompt-injection
 * and off-topic filters. The step guardrail *text* lives in chat/prompt.
 */
export { detectCurrentStep, validateStepTransition, type Step } from './steps';
export {
  extractProblemContext,
  extractLocalitate,
  hasCompleteSummary,
  type ProblemContext,
  type HistoryMessage,
} from './context';
export { isPromptInjectionAttempt, sanitizeMessage, MAX_MESSAGE_LENGTH } from './injection';
export { isOffTopic } from './off-topic';
