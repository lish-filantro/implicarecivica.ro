/**
 * pipeline/analysis/client — the provider-neutral AnalysisClient contract and
 * the ANALYSIS_PROVIDER value parser.
 */
import { describe, it, expect } from 'vitest';
import { ANALYSIS_PROVIDERS, resolveProvider, type AnalysisClient } from '@m544/pipeline/analysis/client';

describe('AnalysisClient', () => {
  it('is satisfied by any object with complete(system, user) → Promise<string>', async () => {
    const client: AnalysisClient = { complete: async (system, user) => `${system}|${user}` };
    await expect(client.complete('S', 'U')).resolves.toBe('S|U');
  });
});

describe('resolveProvider', () => {
  it('defaults to anthropic when the value is missing or blank', () => {
    expect(resolveProvider(undefined)).toBe('anthropic');
    expect(resolveProvider('')).toBe('anthropic');
    expect(resolveProvider('   ')).toBe('anthropic');
  });

  it('accepts the two supported providers, case-insensitively and trimmed', () => {
    expect(resolveProvider('anthropic')).toBe('anthropic');
    expect(resolveProvider('mistral')).toBe('mistral');
    expect(resolveProvider(' Mistral ')).toBe('mistral');
    expect(resolveProvider('ANTHROPIC')).toBe('anthropic');
    expect(ANALYSIS_PROVIDERS).toEqual(['anthropic', 'mistral']);
  });

  it('throws a clear error for anything else', () => {
    expect(() => resolveProvider('openai')).toThrow(
      "Unsupported ANALYSIS_PROVIDER 'openai' (expected 'anthropic' or 'mistral')",
    );
  });
});
