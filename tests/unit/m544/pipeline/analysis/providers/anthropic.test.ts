/**
 * pipeline/analysis/providers/anthropic — Claude Haiku behind AnalysisClient,
 * exercised with a fake SDK (no network).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  createAnthropicAnalysisClient,
  HAIKU_ANALYSIS_MODEL,
  ANTHROPIC_MAX_TOKENS,
  type AnthropicMessagesSdk,
} from '@m544/pipeline/analysis/providers/anthropic';
import { EnvError } from '@m544/shared/env';
import { message, textBlock, toolUse } from '../../../../../fixtures/chat/anthropic-blocks';

type Params = Anthropic.Messages.MessageCreateParamsNonStreaming;

function fakeSdk(response: Anthropic.Messages.Message): AnthropicMessagesSdk & { calls: Params[] } {
  const calls: Params[] = [];
  return {
    calls,
    messages: {
      create: async (params: Params) => {
        calls.push(structuredClone(params));
        return response;
      },
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('createAnthropicAnalysisClient', () => {
  it('sends system + one user message to Haiku with max_tokens 2048 and temperature 0.1', async () => {
    const sdk = fakeSdk(message([textBlock('{"category":"raspunse"}')]));
    const client = createAnthropicAnalysisClient({ sdk });

    await expect(client.complete('SYS', 'USER')).resolves.toBe('{"category":"raspunse"}');
    expect(sdk.calls).toEqual([
      {
        model: HAIKU_ANALYSIS_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        temperature: 0.1,
        system: 'SYS',
        messages: [{ role: 'user', content: 'USER' }],
      },
    ]);
    expect(HAIKU_ANALYSIS_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(ANTHROPIC_MAX_TOKENS).toBe(2048);
  });

  it('honours a model override', async () => {
    const sdk = fakeSdk(message([textBlock('x')]));
    await createAnthropicAnalysisClient({ sdk, model: 'claude-sonnet-4-5' }).complete('S', 'U');
    expect(sdk.calls[0].model).toBe('claude-sonnet-4-5');
  });

  it('concatenates text blocks and ignores non-text blocks', async () => {
    const sdk = fakeSdk(message([textBlock('```json\n{"a":'), toolUse('t1', 'noop', {}), textBlock('1}\n```')]));
    await expect(createAnthropicAnalysisClient({ sdk }).complete('S', 'U')).resolves.toBe('```json\n{"a":1}\n```');
  });

  it('returns an empty string when the answer has no text blocks', async () => {
    const sdk = fakeSdk(message([]));
    await expect(createAnthropicAnalysisClient({ sdk }).complete('S', 'U')).resolves.toBe('');
  });

  it('propagates SDK errors untouched (retry is the caller side)', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    const sdk: AnthropicMessagesSdk = {
      messages: {
        create: async () => {
          throw err;
        },
      },
    };
    await expect(createAnthropicAnalysisClient({ sdk }).complete('S', 'U')).rejects.toBe(err);
  });

  it('fails fast with EnvError when no sdk/apiKey is given and ANTHROPIC_API_KEY is missing or a placeholder', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(() => createAnthropicAnalysisClient()).toThrow(EnvError);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-...');
    expect(() => createAnthropicAnalysisClient()).toThrow(/placeholder/);
  });

  it('builds a real SDK client from an explicit apiKey without reading the environment', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const client = createAnthropicAnalysisClient({ apiKey: 'sk-ant-test-key-0123456789' });
    expect(typeof client.complete).toBe('function');
  });
});
