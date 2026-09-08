/**
 * chat/prompt/step-guardrails — the per-step guardrail appended to the system
 * prompt; STEP_2 is built dynamically from the extracted problem context.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStepGuardrail,
  buildStep2Guardrail,
  STEP_1_GUARDRAIL,
  STEP_3_GUARDRAIL,
} from '@m544/chat/prompt/step-guardrails';

const a = (content: string) => ({ role: 'assistant', content });
const u = (content: string) => ({ role: 'user', content });
const PROBLEMA =
  '✅PROBLEMA_DEFINITĂ: CE:[groapă în asfalt 2m] UNDE:[Strada Libertății nr. 45, Pitești, Argeș] DE_CÂND:[martie 2024]. Confirmă că e corect.';
const INSTITUTIE = '🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Municipiului Pitești';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('getStepGuardrail', () => {
  it('STEP_1: static guardrail', () => {
    const r = getStepGuardrail([u('salut')]);
    expect(r).toEqual({ step: 'STEP_1', guardrail: STEP_1_GUARDRAIL });
    expect(r.guardrail).toContain('[STEP 1 ACTIV]');
    expect(r.guardrail).toContain('✅PROBLEMA_DEFINITĂ: CE:[...] UNDE:[...] DE_CÂND:[...]');
  });

  it('STEP_2: dynamic guardrail with CE, UNDE and localitate', () => {
    const r = getStepGuardrail([u('groapă'), a(PROBLEMA), u('da')]);
    expect(r.step).toBe('STEP_2');
    expect(r.guardrail).toContain('[STEP 2 ACTIV]');
    expect(r.guardrail).toContain(
      'PROBLEMA CONFIRMATĂ: groapă în asfalt 2m la adresa Strada Libertății nr. 45, Pitești, Argeș',
    );
    expect(r.guardrail).toContain('ÎNTREBARE: Care este instituția din Pitești responsabilă pentru groapă în asfalt 2m?');
    expect(r.guardrail).toContain('"🏛INSTITUȚIE_IDENTIFICATĂ: [Numele complet al instituției din Pitești]"');
    expect(r.guardrail).toContain('NU furniza email');
  });

  it('STEP_2 detected but CE/UNDE missing → falls back to STEP_1', () => {
    const r = getStepGuardrail([a('✅PROBLEMA_DEFINITĂ: ok')]);
    expect(r).toEqual({ step: 'STEP_1', guardrail: STEP_1_GUARDRAIL });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missing CE or UNDE'));
  });

  it('STEP_3: static guardrail', () => {
    const r = getStepGuardrail([a(PROBLEMA), u('da'), a(INSTITUTIE)]);
    expect(r).toEqual({ step: 'STEP_3', guardrail: STEP_3_GUARDRAIL });
    expect(r.guardrail).toContain('[STEP 3 ACTIV]');
    expect(r.guardrail).toContain('5 categorii × 5 întrebări');
  });
});

describe('buildStep2Guardrail', () => {
  it('omits the location parts when localitate/unde are unknown', () => {
    const g = buildStep2Guardrail({ ce: 'gunoi', unde: null, cand: null, localitate: null });
    expect(g).toContain('PROBLEMA CONFIRMATĂ: gunoi\n');
    expect(g).toContain('ÎNTREBARE: Care este instituția responsabilă pentru gunoi?');
    expect(g).toContain('[Numele complet al instituției]"');
  });

  it('defaults CE to "problema descrisă"', () => {
    expect(buildStep2Guardrail({ ce: null, unde: null, cand: null, localitate: null })).toContain(
      'responsabilă pentru problema descrisă?',
    );
  });
});
