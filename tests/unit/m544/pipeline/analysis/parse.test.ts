/**
 * pipeline/analysis/parse — JSON extraction, category normalisation,
 * answer_summary parsing and the AnalysisResult assembly.
 * Real model outputs from tests/snapshots/classification-golden.json are used as fixtures.
 */
import { describe, it, expect } from 'vitest';
import {
  parseAnalysisJson,
  normalizeCategory,
  parseAnswerSummary,
  toAnalysisResult,
  AnalysisParseError,
} from '@m544/pipeline/analysis/parse';
import golden from '@/tests/snapshots/classification-golden.json';

const GOLDEN = Object.entries(golden as Record<string, Record<string, unknown>>);

describe('parseAnalysisJson', () => {
  it('parses strict JSON', () => {
    expect(parseAnalysisJson('{"category":"raspunse"}')).toEqual({ category: 'raspunse' });
  });

  it('falls back to a fenced ```json block', () => {
    const raw = 'Iată rezultatul:\n```json\n{"category": "amanate", "confidence": 0.9}\n```\nMulțumesc.';
    expect(parseAnalysisJson(raw)).toEqual({ category: 'amanate', confidence: 0.9 });
  });

  it('accepts a fence without the json language tag', () => {
    expect(parseAnalysisJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws AnalysisParseError when no JSON can be found', () => {
    expect(() => parseAnalysisJson('nu pot analiza')).toThrow(AnalysisParseError);
    expect(() => parseAnalysisJson('nu pot analiza')).toThrow(/Failed to parse analysis JSON: nu pot/);
  });

  it('throws AnalysisParseError when the fenced block is invalid JSON', () => {
    expect(() => parseAnalysisJson('```json\n{oops}\n```')).toThrow(AnalysisParseError);
  });

  it('throws AnalysisParseError when the JSON is not an object', () => {
    expect(() => parseAnalysisJson('null')).toThrow(AnalysisParseError);
    expect(() => parseAnalysisJson('[1,2]')).toThrow(AnalysisParseError);
    expect(() => parseAnalysisJson('"text"')).toThrow(AnalysisParseError);
  });

  it('parses every golden entry serialised back to JSON', () => {
    for (const [, entry] of GOLDEN) {
      expect(parseAnalysisJson(JSON.stringify(entry))).toEqual(entry);
    }
  });
});

describe('normalizeCategory', () => {
  it.each(['inregistrate', 'amanate', 'raspunse', 'intarziate', 'irelevant', 'redirectionat'])(
    'keeps valid category %s',
    (c) => expect(normalizeCategory(c)).toBe(c),
  );

  it('lowercases and trims', () => {
    expect(normalizeCategory('  Raspunse ')).toBe('raspunse');
    expect(normalizeCategory('REDIRECTIONAT')).toBe('redirectionat');
  });

  it('maps null, undefined, empty and unknown values to irelevant', () => {
    expect(normalizeCategory(null)).toBe('irelevant');
    expect(normalizeCategory(undefined)).toBe('irelevant');
    expect(normalizeCategory('')).toBe('irelevant');
    expect(normalizeCategory('necunoscut')).toBe('irelevant');
    expect(normalizeCategory(42)).toBe('irelevant');
    expect(normalizeCategory({})).toBe('irelevant');
  });

  it('does not accept "trimise" (a request status, never a classifier output)', () => {
    expect(normalizeCategory('trimise')).toBe('irelevant');
  });
});

describe('parseAnswerSummary', () => {
  it('parses text / list / table shapes', () => {
    expect(parseAnswerSummary({ type: 'text', content: 'Nu există.' })).toEqual({ type: 'text', content: 'Nu există.' });
    expect(parseAnswerSummary({ type: 'list', content: ['a', 'b'] })).toEqual({ type: 'list', content: ['a', 'b'] });
    expect(parseAnswerSummary({ type: 'table', headers: ['h'], rows: [['1']] })).toEqual({
      type: 'table',
      headers: ['h'],
      rows: [['1']],
    });
  });

  it('drops unknown keys', () => {
    expect(parseAnswerSummary({ type: 'text', content: 'x', extra: 1 })).toEqual({ type: 'text', content: 'x' });
  });

  it('returns null for null, strings, and malformed shapes', () => {
    expect(parseAnswerSummary(null)).toBeNull();
    expect(parseAnswerSummary(undefined)).toBeNull();
    expect(parseAnswerSummary('legacy; string')).toBeNull();
    expect(parseAnswerSummary({ type: 'text', content: ['not', 'string'] })).toBeNull();
    expect(parseAnswerSummary({ type: 'list', content: 'not array' })).toBeNull();
    expect(parseAnswerSummary({ type: 'table', headers: ['h'] })).toBeNull();
    expect(parseAnswerSummary({ type: 'other', content: 'x' })).toBeNull();
  });
});

describe('toAnalysisResult', () => {
  it('reproduces category and registration number for every golden entry', () => {
    expect(GOLDEN.length).toBeGreaterThan(0);
    for (const [, entry] of GOLDEN) {
      const result = toAnalysisResult(entry, JSON.stringify(entry));
      expect(result.category).toBe(entry.category);
      expect(result.registration_number).toBe(entry.registration_number);
      expect(result.answer_summary).toEqual(entry.answer_summary);
      expect(result.confidence).toBe(entry.confidence);
      expect(result.extension_days).toBe(entry.extension_days);
      expect(result.redirected_to).toBeNull();
    }
  });

  it('maps a null category to irelevant instead of throwing', () => {
    const result = toAnalysisResult({ category: null, registration_number: null }, 'text');
    expect(result.category).toBe('irelevant');
    expect(result.registration_number).toBeNull();
  });

  it('rejects a registration number that does not appear in the text', () => {
    const result = toAnalysisResult({ category: 'inregistrate', registration_number: '9999/2025' }, 'nr. 1234/2025');
    expect(result.registration_number).toBeNull();
  });

  it('ignores a non-string registration number', () => {
    expect(toAnalysisResult({ category: 'inregistrate', registration_number: 1234 }, 'nr 1234').registration_number).toBeNull();
  });

  it('keeps redirected_to (trimmed) only for category redirectionat', () => {
    const kept = toAnalysisResult({ category: 'redirectionat', redirected_to: '  Primăria Sector 3 ' }, 'x');
    expect(kept.redirected_to).toBe('Primăria Sector 3');
    expect(toAnalysisResult({ category: 'raspunse', redirected_to: 'Primăria' }, 'x').redirected_to).toBeNull();
    expect(toAnalysisResult({ category: 'redirectionat', redirected_to: '   ' }, 'x').redirected_to).toBeNull();
    expect(toAnalysisResult({ category: 'redirectionat', redirected_to: 7 }, 'x').redirected_to).toBeNull();
    expect(toAnalysisResult({ category: 'redirectionat' }, 'x').redirected_to).toBeNull();
  });

  it('applies defaults for missing or mistyped fields', () => {
    const result = toAnalysisResult({ category: 'amanate', confidence: 'high', extension_days: '30' }, 'x');
    expect(result).toEqual({
      category: 'amanate',
      registration_number: null,
      registration_date: null,
      response_date: null,
      answer_summary: null,
      extension_days: null,
      extension_reason: null,
      redirected_to: null,
      evidence: '',
      confidence: 0,
    });
  });

  it('passes through well-typed optional fields', () => {
    const result = toAnalysisResult(
      {
        category: 'amanate',
        registration_date: '2025-11-18',
        response_date: '2025-12-18',
        extension_days: 30,
        extension_reason: 'volum mare',
        evidence: 'ev',
        confidence: 0.75,
      },
      'x',
    );
    expect(result.registration_date).toBe('2025-11-18');
    expect(result.response_date).toBe('2025-12-18');
    expect(result.extension_days).toBe(30);
    expect(result.extension_reason).toBe('volum mare');
    expect(result.evidence).toBe('ev');
    expect(result.confidence).toBe(0.75);
  });
});
