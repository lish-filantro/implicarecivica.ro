/**
 * pipeline/analysis/index — the public surface re-exported from the module root.
 */
import { describe, it, expect } from 'vitest';
import * as analysis from '@m544/pipeline/analysis';

describe('pipeline/analysis public API', () => {
  it('re-exports the orchestrator, parsers, prompt and retry helper', () => {
    expect(typeof analysis.analyzeEmailContent).toBe('function');
    expect(typeof analysis.buildAnalysisUserMessage).toBe('function');
    expect(typeof analysis.EMAIL_ANALYSIS_SYSTEM_PROMPT).toBe('string');
    expect(typeof analysis.MISTRAL_ANALYSIS_MODEL).toBe('string');
    expect(typeof analysis.validateRegistrationNumber).toBe('function');
    expect(typeof analysis.parseAnalysisJson).toBe('function');
    expect(typeof analysis.normalizeCategory).toBe('function');
    expect(typeof analysis.parseAnswerSummary).toBe('function');
    expect(typeof analysis.toAnalysisResult).toBe('function');
    expect(typeof analysis.AnalysisParseError).toBe('function');
    expect(typeof analysis.withRetry).toBe('function');
  });

  it('re-exports the provider layer (clients, models, provider resolution)', () => {
    expect(analysis.HAIKU_ANALYSIS_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(analysis.MISTRAL_ANALYSIS_MODEL).toBe('ministral-14b-latest');
    expect(typeof analysis.createAnthropicAnalysisClient).toBe('function');
    expect(typeof analysis.createMistralAnalysisClient).toBe('function');
    expect(typeof analysis.createAnalysisClient).toBe('function');
    expect(analysis.resolveProvider(undefined)).toBe('anthropic');
    expect(analysis.ANALYSIS_PROVIDERS).toEqual(['anthropic', 'mistral']);
  });
});
