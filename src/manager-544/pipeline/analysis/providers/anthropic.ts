/**
 * Claude Haiku as the email classifier.
 *
 * No JSON mode: the system prompt demands a bare JSON object and `parseAnalysisJson`
 * also accepts a fenced ```json block. The SDK is injected through a structural slice
 * so tests never touch the network; production builds the real client from
 * ANTHROPIC_API_KEY (a placeholder key is an EnvError, not a silent fallback).
 */
import Anthropic from '@anthropic-ai/sdk';
import { requireSecret } from '@m544/shared/env';
import type { AnalysisClient } from '../client';

export const HAIKU_ANALYSIS_MODEL = 'claude-haiku-4-5-20251001';
export const ANTHROPIC_MAX_TOKENS = 2048;

/** Low temperature for deterministic extraction. */
const ANALYSIS_TEMPERATURE = 0.1;

/** The part of the Anthropic SDK the analyser uses (`new Anthropic(...)` satisfies it). */
export interface AnthropicMessagesSdk {
  messages: {
    create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Messages.Message>;
  };
}

export interface AnthropicAnalysisOptions {
  /** Explicit key; defaults to ANTHROPIC_API_KEY. Ignored when `sdk` is given. */
  apiKey?: string;
  /** Defaults to HAIKU_ANALYSIS_MODEL. */
  model?: string;
  /** Injected SDK (tests); defaults to a real client. */
  sdk?: AnthropicMessagesSdk;
}

function textOf(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function createAnthropicAnalysisClient(opts: AnthropicAnalysisOptions = {}): AnalysisClient {
  const model = opts.model ?? HAIKU_ANALYSIS_MODEL;
  const sdk = opts.sdk ?? new Anthropic({ apiKey: opts.apiKey ?? requireSecret('ANTHROPIC_API_KEY') });

  return {
    async complete(system, user) {
      const response = await sdk.messages.create({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        temperature: ANALYSIS_TEMPERATURE,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return textOf(response);
    },
  };
}
