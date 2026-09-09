/**
 * questions/set-prompt — the forced tool, the user prompt built from the
 * context and the parser of the tool input.
 */
import { describe, it, expect } from 'vitest';
import {
  EMIT_QUESTIONS_TOOL,
  QUESTIONS_PER_CATEGORY,
  buildSetSystemPrompt,
  buildSetUserPrompt,
  parseQuestionSet,
  countQuestions,
} from '@m544/questions/set-prompt';
import { VALID_CATEGORIES } from '@m544/questions/prompt';

const ctx = {
  institutionName: 'Primăria Pitești',
  problemContext: { ce: 'groapă în asfalt', unde: 'Str. Lalelelor 5, Pitești, Argeș', cand: 'martie 2026' },
  transcript: 'user: Am gropi pe strada mea\nassistant: Unde exact?',
  existingQuestions: ['Care este bugetul alocat reparațiilor în 2025?'],
};

describe('EMIT_QUESTIONS_TOOL', () => {
  it('requires exactly the five categories, each an array of 5 strings', () => {
    const schema = EMIT_QUESTIONS_TOOL.input_schema as {
      required?: string[];
      properties?: Record<string, { type: string; minItems: number; maxItems: number }>;
    };
    expect(EMIT_QUESTIONS_TOOL.name).toBe('emit_questions');
    expect(schema.required).toEqual(VALID_CATEGORIES);
    for (const c of VALID_CATEGORIES) {
      expect(schema.properties?.[c]).toMatchObject({ type: 'array', minItems: QUESTIONS_PER_CATEGORY, maxItems: QUESTIONS_PER_CATEGORY });
    }
  });
});

describe('buildSetSystemPrompt / buildSetUserPrompt', () => {
  it('system prompt keeps the 544 expert role and forces the tool', () => {
    const s = buildSetSystemPrompt();
    expect(s).toContain('Legea 544/2001');
    expect(s).toContain('emit_questions');
  });

  it('user prompt carries the context, the transcript and the do-not-repeat list', () => {
    const p = buildSetUserPrompt(ctx);
    expect(p).toContain('Primăria Pitești');
    expect(p).toContain('groapă în asfalt');
    expect(p).toContain('Str. Lalelelor 5');
    expect(p).toContain('martie 2026');
    expect(p).toContain('user: Am gropi pe strada mea');
    expect(p).toContain('Care este bugetul alocat reparațiilor în 2025?');
    expect(p).toMatch(/NU repeta/);
    for (const c of VALID_CATEGORIES) expect(p).toContain(c);
  });

  it('omits the transcript and repeat blocks when empty, and marks unknown context', () => {
    const p = buildSetUserPrompt({ institutionName: '', problemContext: null, transcript: '', existingQuestions: [] });
    expect(p).not.toContain('Conversația cu cetățeanul');
    expect(p).not.toContain('NU repeta');
    expect(p).toContain('CE: nespecificat');
    expect(p).toContain('INSTITUȚIE: nespecificată');
  });
});

describe('parseQuestionSet', () => {
  it('trims, drops empties, caps per category and tolerates a missing/invalid category', () => {
    const set = parseQuestionSet({
      A_FINANCIAR: [' a ', '', 'b', 'c', 'd', 'e', 'f'],
      B_RESPONSABILITATE: 'nope',
      C_PLANIFICARE: [1, 'x'],
    });
    expect(set.A_FINANCIAR).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(set.B_RESPONSABILITATE).toEqual([]);
    expect(set.C_PLANIFICARE).toEqual(['x']);
    expect(set.D_MONITORIZARE).toEqual([]);
    expect(set.E_CONFORMITATE).toEqual([]);
    expect(countQuestions(set)).toBe(6);
  });

  it('returns five empty lists for a non-object input', () => {
    const set = parseQuestionSet(null);
    expect(Object.keys(set)).toEqual(VALID_CATEGORIES);
    expect(countQuestions(set)).toBe(0);
  });
});
