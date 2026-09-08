/**
 * Anthropic client for the chat. The handler depends only on the structural
 * `MessagesClient` slice so tests inject a scripted fake; production uses the SDK.
 */
import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv } from '@m544/shared/env';

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const MAX_TOKENS = 2048;

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
