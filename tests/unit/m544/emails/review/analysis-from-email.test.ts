import { describe, it, expect } from 'vitest';
import { analysisFromEmail, fallbackAnalysis } from '@m544/emails/review/analysis-from-email';
import { makeEmail } from '../../ui/emails/_fixtures';

describe('analysisFromEmail', () => {
  it('rebuilds the AnalysisResult saved by the pipeline', () => {
    const email = makeEmail({
      ai_extracted_data: {
        ocr: { pages: 1 },
        analysis: {
          category: 'amanate',
          registration_number: '123',
          answer_summary: null,
          redirected_to: null,
          confidence: 0.8,
          evidence: 'se prelungește',
          extension_days: 30,
          extension_reason: 'volum mare',
        },
      },
    });
    expect(analysisFromEmail(email)).toEqual({
      category: 'amanate',
      registration_number: '123',
      registration_date: null,
      response_date: null,
      answer_summary: null,
      extension_days: 30,
      extension_reason: 'volum mare',
      redirected_to: null,
      evidence: 'se prelungește',
      confidence: 0.8,
    });
  });

  it('tolerates partial data: missing fields become null, category falls back to the email column', () => {
    const email = makeEmail({ category: 'raspunse', registration_number: '77', ai_extracted_data: { analysis: {} } });
    const a = analysisFromEmail(email)!;
    expect(a.category).toBe('raspunse');
    expect(a.registration_number).toBe('77');
    expect(a.answer_summary).toBeNull();
    expect(a.evidence).toBe('');
    expect(a.confidence).toBe(0);
  });

  it('keeps structured answer summaries', () => {
    const email = makeEmail({
      ai_extracted_data: { analysis: { category: 'raspunse', answer_summary: { type: 'list', content: ['a', 'b'] } } },
    });
    expect(analysisFromEmail(email)!.answer_summary).toEqual({ type: 'list', content: ['a', 'b'] });
  });

  it('returns null when no analysis was saved and the email has no category, or the category is unknown', () => {
    expect(analysisFromEmail(makeEmail({ category: null }))).toBeNull();
    expect(analysisFromEmail(makeEmail({ ai_extracted_data: { analysis: { category: 'spam' } } }))).toBeNull();
    expect(analysisFromEmail(makeEmail({ ai_extracted_data: { analysis: 'garbage' } }))).toBeNull();
  });

  it('fallbackAnalysis builds a minimal result from a category and the email registration number', () => {
    expect(fallbackAnalysis('inregistrate', makeEmail({ registration_number: '9' }))).toMatchObject({
      category: 'inregistrate',
      registration_number: '9',
      answer_summary: null,
      confidence: 1,
    });
    expect(fallbackAnalysis('irelevant', makeEmail()).registration_number).toBeNull();
  });
});
