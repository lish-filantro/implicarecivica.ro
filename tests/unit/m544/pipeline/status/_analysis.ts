/** Test helper: a complete AnalysisResult with overridable fields. */
import type { AnalysisResult } from '@m544/pipeline/types';

export function mkAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    category: 'raspunse',
    registration_number: null,
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    redirected_to: null,
    evidence: '',
    confidence: 0.9,
    ...overrides,
  };
}
