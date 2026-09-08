/**
 * Anthropic client for the chat. The handler depends only on the structural
 * `MessagesClient` slice so tests inject a scripted fake; production uses the SDK.
 */
import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv } from '@m544/shared/env';

/**
 * Chat model. Sonnet 5 by default (2026-09-09, user decision: Haiku did not find
 * the right institutional addresses); override per environment with CHAT_MODEL.
 * Classification stays on Haiku (pipeline/analysis), question generation too.
 */
export const DEFAULT_CHAT_MODEL = 'claude-sonnet-5';
export function chatModel(): string {
  return optionalEnv('CHAT_MODEL', DEFAULT_CHAT_MODEL);
}
/** Room for citations + the STEP_2 single-message answer; Sonnet is wordier than Haiku. */
export const MAX_TOKENS = 4096;

/** The part of the Anthropic SDK the chat uses (`new Anthropic(...)` satisfies it). */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Messages.Message>;
  };
}

export function isAnthropicConfigured(): boolean {
  return optionalEnv('ANTHROPIC_API_KEY') !== undefined;
}

/** Real client, or null when ANTHROPIC_API_KEY is not set (the handler answers 500). */
export function createAnthropicClient(): MessagesClient | null {
  const apiKey = optionalEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}
