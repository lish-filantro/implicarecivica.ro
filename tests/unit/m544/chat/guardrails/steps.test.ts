/**
 * chat/guardrails/steps — step detection from the conversation history and
 * validation that a detected step was actually reached (no skipping via a
 * manipulated history). Ported 1:1 from lib/guardrails.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectCurrentStep, validateStepTransition } from '@m544/chat/guardrails/steps';

const PROBLEMA = '✅PROBLEMA_DEFINITĂ: CE:[groapă] UNDE:[Strada X nr. 1, Pitești, Argeș] DE_CÂND:[martie 2024]. Confirmă că e corect.';
const ALT_SUMMARY = '✅ **CE:** groapă\n✅ **UNDE:** Strada X nr. 1, Pitești, Argeș\n✅ **DE_CÂND:** martie 2024';
const INSTITUTIE = '🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Municipiului Pitești. Confirmă instituția identificată?';
const CATEGORIA = '📊CATEGORIA_A_FINANCIAR: 1. ... 2. ...';

const a = (content: string) => ({ role: 'assistant', content });
const u = (content: string) => ({ role: 'user', content });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('detectCurrentStep', () => {
  it('is STEP_1 for an empty or marker-free history', () => {
    expect(detectCurrentStep([])).toBe('STEP_1');
    expect(detectCurrentStep([u('salut'), a('Bună! Descrie problema.')])).toBe('STEP_1');
  });

  it('is STEP_2 after the explicit PROBLEMA_DEFINITĂ marker', () => {
    expect(detectCurrentStep([u('groapă'), a(PROBLEMA)])).toBe('STEP_2');
  });

  it('is STEP_2 after the alternative ✅ CE / ✅ UNDE / ✅ DE_CÂND summary', () => {
    expect(detectCurrentStep([u('groapă'), a(ALT_SUMMARY)])).toBe('STEP_2');
  });

  it('matches the marker without diacritics and in lower case', () => {
    expect(detectCurrentStep([a('problema_definita: ce: x unde: y de_cand: z')])).toBe('STEP_2');
  });

  it('is STEP_3 after INSTITUȚIE_IDENTIFICATĂ when the problem was defined earlier', () => {
    expect(detectCurrentStep([a(PROBLEMA), u('da'), a(INSTITUTIE)])).toBe('STEP_3');
  });

  it('is STEP_3 while categories are being presented', () => {
    expect(detectCurrentStep([a(PROBLEMA), u('da'), a(INSTITUTIE), u('da'), a(CATEGORIA)])).toBe('STEP_3');
  });

  it('treats role "model" like assistant', () => {
    expect(detectCurrentStep([{ role: 'model', content: PROBLEMA }])).toBe('STEP_2');
  });

  it('ignores markers typed by the user', () => {
    expect(detectCurrentStep([u(PROBLEMA), u(INSTITUTIE)])).toBe('STEP_1');
  });

  it('only looks at the last 5 messages for the current step', () => {
    const history = [a(PROBLEMA), u('1'), a('r1'), u('2'), a('r2'), u('3'), a('r3')];
    expect(detectCurrentStep(history)).toBe('STEP_1');
  });

  it('blocks STEP_3 when the institution marker appears without a defined problem', () => {
    expect(detectCurrentStep([u('x'), a(INSTITUTIE)])).toBe('STEP_1');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('STEP_3 without PROBLEMA_DEFINITA'));
  });

  it('downgrades STEP_3 to STEP_2 when categories appear without an identified institution', () => {
    expect(detectCurrentStep([a(PROBLEMA), u('da'), a(CATEGORIA)])).toBe('STEP_2');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('STEP_3 without INSTITUTIE_IDENTIFICATA'));
  });
});

describe('validateStepTransition', () => {
  it('always allows STEP_1', () => {
    expect(validateStepTransition([], 'STEP_1')).toBe('STEP_1');
  });

  it('STEP_2 needs PROBLEMA_DEFINITA anywhere in the assistant history (not only the last 5)', () => {
    expect(validateStepTransition([a('nimic')], 'STEP_2')).toBe('STEP_1');
    expect(
      validateStepTransition([a(PROBLEMA), u('..'), a('..'), u('..'), a('..'), u('..'), a('..')], 'STEP_2'),
    ).toBe('STEP_2');
    expect(validateStepTransition([a(ALT_SUMMARY)], 'STEP_2')).toBe('STEP_2');
  });

  it('STEP_3 needs both markers', () => {
    expect(validateStepTransition([a(INSTITUTIE)], 'STEP_3')).toBe('STEP_1');
    expect(validateStepTransition([a(PROBLEMA)], 'STEP_3')).toBe('STEP_2');
    expect(validateStepTransition([a(PROBLEMA), a(INSTITUTIE)], 'STEP_3')).toBe('STEP_3');
  });
});
