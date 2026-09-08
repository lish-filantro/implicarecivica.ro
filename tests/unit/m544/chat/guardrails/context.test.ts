/**
 * chat/guardrails/context — CE / UNDE / CÂND extraction from the assistant's
 * problem summary (both marker formats), plus locality extraction from UNDE.
 */
import { describe, it, expect } from 'vitest';
import { extractProblemContext, extractLocalitate, hasCompleteSummary } from '@m544/chat/guardrails/context';

const a = (content: string) => ({ role: 'assistant', content });
const u = (content: string) => ({ role: 'user', content });

describe('extractProblemContext', () => {
  it('reads the bracketed ✅PROBLEMA_DEFINITĂ format', () => {
    const ctx = extractProblemContext([
      u('am o groapă'),
      a('✅PROBLEMA_DEFINITĂ: CE:[groapă în asfalt 2m] UNDE:[Strada Libertății nr. 45, Pitești, Argeș] DE_CÂND:[martie 2024]. Confirmă că e corect.'),
    ]);
    expect(ctx).toEqual({
      ce: 'groapă în asfalt 2m',
      unde: 'Strada Libertății nr. 45, Pitești, Argeș',
      cand: 'martie 2024',
      localitate: 'Pitești',
    });
  });

  it('reads the alternative ✅ per-field format with markdown bold and no brackets', () => {
    const ctx = extractProblemContext([
      a('✅ **CE:** Groapă în asfalt\n✅ **UNDE:** Strada Mioriței nr. 12, Comuna Pantelimon, Ilfov\n✅ **DE_CÂND:** din ianuarie 2025\n\nConfirmă că e corect.'),
    ]);
    expect(ctx).toEqual({
      ce: 'Groapă în asfalt',
      unde: 'Strada Mioriței nr. 12, Comuna Pantelimon, Ilfov',
      cand: 'din ianuarie 2025',
      localitate: 'Pantelimon',
    });
  });

  it('returns nulls when no summary exists or the marker is only in a user message', () => {
    const empty = { ce: null, unde: null, cand: null, localitate: null };
    expect(extractProblemContext([])).toEqual(empty);
    expect(extractProblemContext([a('Descrie problema.')])).toEqual(empty);
    expect(extractProblemContext([u('✅PROBLEMA_DEFINITĂ: CE:[x] UNDE:[y, Z, W] DE_CÂND:[t]')])).toEqual(empty);
  });

  it('uses the first summary in the history when several exist', () => {
    const ctx = extractProblemContext([
      a('✅PROBLEMA_DEFINITĂ: CE:[prima] UNDE:[Str. A nr. 1, Cluj-Napoca, Cluj] DE_CÂND:[2024]'),
      a('✅PROBLEMA_DEFINITĂ: CE:[a doua] UNDE:[Str. B nr. 2, Iași, Iași] DE_CÂND:[2025]'),
    ]);
    expect(ctx.ce).toBe('prima');
    expect(ctx.localitate).toBe('Cluj-Napoca');
  });

  it('accepts role "model" and the marker without diacritics', () => {
    const ctx = extractProblemContext([
      { role: 'model', content: 'PROBLEMA_DEFINITA: CE:[gunoi] UNDE:[Str. C nr. 3, Brașov, Brașov] DE_CAND:[ieri]' },
    ]);
    expect(ctx.ce).toBe('gunoi');
    expect(ctx.cand).toBe('ieri');
  });

  it('leaves localitate null when UNDE has no ", localitate, județ" tail', () => {
    const ctx = extractProblemContext([a('✅PROBLEMA_DEFINITĂ: CE:[x] UNDE:[Strada Lungă nr. 5] DE_CÂND:[2024]')]);
    expect(ctx.unde).toBe('Strada Lungă nr. 5');
    expect(ctx.localitate).toBeNull();
  });
});

describe('extractLocalitate', () => {
  it('takes the second-to-last comma segment, dropping Comuna/Orașul/Municipiul', () => {
    expect(extractLocalitate('Strada Libertății nr. 45, Pitești, Argeș')).toBe('Pitești');
    expect(extractLocalitate('Str. X nr. 1, Municipiul Pitești, județul Argeș')).toBe('Pitești');
    expect(extractLocalitate('Str. X nr. 1, Orașul Mioveni, Argeș')).toBe('Mioveni');
    expect(extractLocalitate('Str. X nr. 1, Comuna Pantelimon, Ilfov')).toBe('Pantelimon');
  });

  it('returns null without a locality/county pair', () => {
    expect(extractLocalitate('Strada X nr 1')).toBeNull();
  });

  it('legacy limitation: digits are not allowed in the segments, so "București, Sector 3" is not recognised', () => {
    expect(extractLocalitate('Bulevardul Unirii nr. 5, București, Sector 3')).toBeNull();
  });
});

describe('hasCompleteSummary', () => {
  it('needs ✅ CE, ✅ UNDE and ✅ (DE_)CÂND, tolerating bold markers', () => {
    expect(hasCompleteSummary('✅ CE: x ✅ UNDE: y ✅ CÂND: z')).toBe(true);
    expect(hasCompleteSummary('✅ **CE**: x\n✅ **UNDE**: y\n✅ **DE_CAND**: z')).toBe(true);
    expect(hasCompleteSummary('✅ CE: x ✅ UNDE: y')).toBe(false);
    expect(hasCompleteSummary('CE: x UNDE: y CÂND: z')).toBe(false);
  });
});
