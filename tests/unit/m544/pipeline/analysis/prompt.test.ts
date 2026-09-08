/**
 * pipeline/analysis/prompt — system prompt (extended with `irelevant` and
 * `redirectionat`) and the user message builder.
 */
import { describe, it, expect } from 'vitest';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage } from '@m544/pipeline/analysis/prompt';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT as LEGACY_PROMPT } from '@/lib/mistral/constants';

describe('EMAIL_ANALYSIS_SYSTEM_PROMPT', () => {
  it('keeps the legacy content (every legacy line still present)', () => {
    const legacyLines = LEGACY_PROMPT.split('\n').filter((l) => l.trim().length > 0);
    // The only legacy lines allowed to change are the two category enumerations.
    const changed = legacyLines.filter((l) => !EMAIL_ANALYSIS_SYSTEM_PROMPT.includes(l));
    expect(changed).toEqual([
      '2. Clasifică răspunsul în una din categoriile: trimise, inregistrate, amanate, raspunse, intarziate.',
      '  "category": "inregistrate" | "amanate" | "raspunse" | "intarziate",',
    ]);
  });

  it('declares the two new categories in the JSON schema', () => {
    expect(EMAIL_ANALYSIS_SYSTEM_PROMPT).toContain(
      '"category": "inregistrate" | "amanate" | "raspunse" | "intarziate" | "redirectionat" | "irelevant",',
    );
    expect(EMAIL_ANALYSIS_SYSTEM_PROMPT).toContain('"redirected_to": string | null,');
  });

  it('has a classification rule and an example for each new category', () => {
    const rules = EMAIL_ANALYSIS_SYSTEM_PROMPT.match(/^- (irelevant|redirectionat):/gm) ?? [];
    expect(rules.sort()).toEqual(['- irelevant:', '- redirectionat:']);
    expect(EMAIL_ANALYSIS_SYSTEM_PROMPT).toMatch(/Exemple.*\n[\s\S]*irelevant/);
    expect(EMAIL_ANALYSIS_SYSTEM_PROMPT).toMatch(/redirected_to/);
    expect(EMAIL_ANALYSIS_SYSTEM_PROMPT).toContain('newsletter');
  });
});

describe('buildAnalysisUserMessage', () => {
  it('produces the legacy layout with body and OCR', () => {
    const msg = buildAnalysisUserMessage({
      fromEmail: 'a@b.ro',
      subject: 'Re: cerere',
      body: 'Buna ziua',
      ocrText: 'Nr. 123/2025',
    });
    expect(msg).toBe(
      'De la: a@b.ro\nSubiect: Re: cerere\n\nConținut email:\nBuna ziua\n\nConținut PDF (OCR):\nNr. 123/2025',
    );
  });

  it('omits the body and OCR sections when empty or missing', () => {
    expect(buildAnalysisUserMessage({ fromEmail: 'a@b.ro', subject: 'S', body: '' })).toBe(
      'De la: a@b.ro\nSubiect: S',
    );
    expect(buildAnalysisUserMessage({ fromEmail: 'a@b.ro', subject: 'S', body: 'x', ocrText: '' })).toBe(
      'De la: a@b.ro\nSubiect: S\n\nConținut email:\nx',
    );
  });

  it('truncates the body to 3000 and the OCR text to 5000 characters', () => {
    const msg = buildAnalysisUserMessage({
      fromEmail: 'a@b.ro',
      subject: 'S',
      body: 'b'.repeat(3500),
      ocrText: 'o'.repeat(6000),
    });
    expect(msg).toContain('\nConținut email:\n' + 'b'.repeat(3000) + '\n');
    expect(msg.endsWith('\nConținut PDF (OCR):\n' + 'o'.repeat(5000))).toBe(true);
    expect(msg).not.toContain('b'.repeat(3001));
  });
});
