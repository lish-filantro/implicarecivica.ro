/**
 * chat/validation/output — system prompt leak detection, soft step checks,
 * sanitization and per-step fallbacks.
 */
import { describe, it, expect } from 'vitest';
import { validateOutput, sanitizeOutput, getFallbackResponse } from '@m544/chat/validation/output';

describe('validateOutput', () => {
  it('flags system prompt fragments as a leak', () => {
    const r = validateOutput('Conform PRIORITATE_ABSOLUTĂ și MEMORIE_INTERNĂ trebuie să...', 'STEP_1');
    expect(r.containsSystemLeak).toBe(true);
    expect(r.isValid).toBe(false);
    expect(r.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('System prompt leak: "PRIORITATE_ABSOLUTĂ')]),
    );
    expect(r.issues.filter((i) => i.startsWith('System prompt leak'))).toHaveLength(2);
  });

  it('accepts a normal STEP_1 answer', () => {
    const r = validateOutput('Bună! Descrie-mi problema: ce ai observat, unde și de când?', 'STEP_1');
    expect(r).toEqual({ isValid: true, issues: [], containsSystemLeak: false, isOnTopic: true });
  });

  it('marks STEP_1 answers without CE/UNDE/CÂND content as off-topic (soft)', () => {
    const r = validateOutput('Vremea este frumoasă astăzi la munte.', 'STEP_1');
    expect(r.isOnTopic).toBe(false);
    expect(r.isValid).toBe(false);
    expect(r.issues).toContain('STEP_1: nu conține conținut despre CE/UNDE/CÂND');
  });

  it('reports too short / too long outputs', () => {
    expect(validateOutput('ok', 'STEP_2').issues).toContain('Răspuns prea scurt (< 10 chars)');
    expect(validateOutput('x'.repeat(8001), 'STEP_2').issues).toContain('Răspuns neobișnuit de lung (> 8000 chars)');
  });

  it('STEP_3 must mention categories', () => {
    expect(validateOutput('Iată răspunsul meu fără nimic util aici.', 'STEP_3').issues).toContain(
      'STEP_3: nu menționează categorii de întrebări',
    );
    expect(validateOutput('📊CATEGORIA_A_FINANCIAR: 1. Ce buget...', 'STEP_3').isValid).toBe(true);
  });
});

describe('sanitizeOutput', () => {
  it('replaces every fragment occurrence with [...]', () => {
    expect(sanitizeOutput('A REGULĂ_AUR b REGULĂ_AUR c FLUX_OBLIGATORIU')).toBe('A [...] b [...] c [...]');
  });
});

describe('getFallbackResponse', () => {
  it('has a distinct fallback per step', () => {
    expect(getFallbackResponse('STEP_1')).toContain('**CE**');
    expect(getFallbackResponse('STEP_2')).toContain('identificarea instituției');
    expect(getFallbackResponse('STEP_3')).toContain('întrebărilor strategice');
  });
});
