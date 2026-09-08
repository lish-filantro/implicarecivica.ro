/**
 * questions/prompt — the five categories and the prompt sent to the model.
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_CONFIG,
  VALID_CATEGORIES,
  SYSTEM_PROMPT,
  HAIKU_MODEL,
  buildUserPrompt,
} from '@m544/questions/prompt';

describe('CATEGORY_CONFIG', () => {
  it('has the five A-E categories with label + description', () => {
    expect(VALID_CATEGORIES).toEqual([
      'A_FINANCIAR',
      'B_RESPONSABILITATE',
      'C_PLANIFICARE',
      'D_MONITORIZARE',
      'E_CONFORMITATE',
    ]);
    for (const key of VALID_CATEGORIES) {
      expect(CATEGORY_CONFIG[key].label).toMatch(/^[A-E]\. /);
      expect(CATEGORY_CONFIG[key].description.length).toBeGreaterThan(10);
    }
  });
});

describe('SYSTEM_PROMPT / HAIKU_MODEL', () => {
  it('pins the legal domain, Romanian output and the Haiku model', () => {
    expect(SYSTEM_PROMPT).toMatch(/544\/2001/);
    expect(SYSTEM_PROMPT).toMatch(/limba română/);
    expect(HAIKU_MODEL).toBe('claude-haiku-4-5-20251001');
  });
});

describe('buildUserPrompt', () => {
  it('embeds category label + description and the problem context', () => {
    const p = buildUserPrompt('groapă în asfalt', 'str. Lungă 5, Brașov', 'martie 2026', 'Primăria Brașov', 'A_FINANCIAR');
    expect(p).toContain('categoria A. Financiar (Buget, cheltuieli, contracte, achiziții publice, fonduri alocate)');
    expect(p).toContain('- CE: groapă în asfalt');
    expect(p).toContain('- UNDE: str. Lungă 5, Brașov');
    expect(p).toContain('- DE CÂND: martie 2026');
    expect(p).toContain('- INSTITUȚIE: Primăria Brașov');
    expect(p).toMatch(/exact 10 întrebări/);
    expect(p).toMatch(/numerotate 1-10/);
  });

  it('falls back to "nespecificat(ă)" for missing date / institution', () => {
    const p = buildUserPrompt('ce', 'unde', '', '', 'E_CONFORMITATE');
    expect(p).toContain('- DE CÂND: nespecificat');
    expect(p).toContain('- INSTITUȚIE: nespecificată');
    expect(p).toContain('aspecte diferite ale categoriei E. Conformitate');
  });
});
