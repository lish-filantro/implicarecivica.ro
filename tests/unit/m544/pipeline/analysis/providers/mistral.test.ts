/**
 * pipeline/analysis/providers/mistral — the legacy JSON-mode adapter behind
 * AnalysisClient, exercised with a fake chat SDK (no network).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createMistralAnalysisClient,
  MISTRAL_ANALYSIS_MODEL,
  type ChatCompletionArgs,
  type ChatCompletionClient,
} from '@m544/pipeline/analysis/providers/mistral';
import { EnvError } from '@m544/shared/env';

function fakeSdk(content: unknown): ChatCompletionClient & { calls: ChatCompletionArgs[] } {
  const calls: ChatCompletionArgs[] = [];
  return {
    calls,
    async complete(args) {
      calls.push(args);
      return { choices: [{ message: { content } }] };
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('createMistralAnalysisClient', () => {
  it('calls chat.complete in JSON mode with system + user messages and the default model', async () => {
    const sdk = fakeSdk('{"category":"amanate"}');
    const client = createMistralAnalysisClient({ sdk });

    await expect(client.complete('SYS', 'USER')).resolves.toBe('{"category":"amanate"}');
    expect(sdk.calls).toEqual([
      {
        model: MISTRAL_ANALYSIS_MODEL,
        messages: [
          { role: 'system', content: 'SYS' },
          { role: 'user', content: 'USER' },
        ],
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      },
    ]);
    expect(MISTRAL_ANALYSIS_MODEL).toBe('ministral-14b-latest');
  });

  it('honours a model override', async () => {
    const sdk = fakeSdk('{}');
    await createMistralAnalysisClient({ sdk, model: 'mistral-large-latest' }).complete('S', 'U');
    expect(sdk.calls[0].model).toBe('mistral-large-latest');
  });

  it('returns an empty string for non-string or missing content', async () => {
    const chunks = fakeSdk([{ type: 'text', text: '{}' }]);
    await expect(createMistralAnalysisClient({ sdk: chunks }).complete('S', 'U')).resolves.toBe('');
    await expect(createMistralAnalysisClient({ sdk: fakeSdk(undefined) }).complete('S', 'U')).resolves.toBe('');
    const noChoices: ChatCompletionClient = { complete: async () => ({}) };
    await expect(createMistralAnalysisClient({ sdk: noChoices }).complete('S', 'U')).resolves.toBe('');
  });

  it('propagates SDK errors untouched', async () => {
    const err = Object.assign(new Error('Too many requests'), { statusCode: 429 });
    const sdk: ChatCompletionClient = {
      complete: async () => {
        throw err;
      },
    };
    await expect(createMistralAnalysisClient({ sdk }).complete('S', 'U')).rejects.toBe(err);
  });

  it('fails fast with EnvError when no sdk/apiKey is given and MISTRAL_API_KEY is missing', () => {
    vi.stubEnv('MISTRAL_API_KEY', '');
    expect(() => createMistralAnalysisClient()).toThrow(EnvError);
  });

  it('builds a real SDK client from an explicit apiKey without reading the environment', () => {
    vi.stubEnv('MISTRAL_API_KEY', '');
    expect(typeof createMistralAnalysisClient({ apiKey: 'test-mistral-key' }).complete).toBe('function');
  });
});
