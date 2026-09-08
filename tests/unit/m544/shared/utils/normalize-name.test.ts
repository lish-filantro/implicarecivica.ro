/**
 * shared/utils/normalize-name — the canonical key of an institution name
 * (`institutii_locale.nume_normalizat`): lower-case, no diacritics, one space
 * between words, punctuation dropped except hyphens.
 */
import { describe, it, expect } from 'vitest';
import { normalizeInstitutionName } from '@m544/shared/utils/normalize-name';

describe('normalizeInstitutionName', () => {
  it('lower-cases, strips diacritics (both comma-below and cedilla forms) and trims', () => {
    expect(normalizeInstitutionName('  Primăria Municipiului Pitești ')).toBe('primaria municipiului pitesti');
    expect(normalizeInstitutionName('Consiliul Judeţean Argeş')).toBe('consiliul judetean arges');
    expect(normalizeInstitutionName('PRIMĂRIA SECTORULUI 3')).toBe('primaria sectorului 3');
  });

  it('collapses whitespace (spaces, tabs, newlines)', () => {
    expect(normalizeInstitutionName('Primăria \t Comunei\n  Pantelimon')).toBe('primaria comunei pantelimon');
  });

  it('drops punctuation but keeps hyphens and digits', () => {
    expect(normalizeInstitutionName('Primăria Mun. Cluj-Napoca (jud. Cluj)')).toBe('primaria mun cluj-napoca jud cluj');
    expect(normalizeInstitutionName('Direcția Generală / Ilfov, str. X')).toBe('directia generala ilfov str x');
    expect(normalizeInstitutionName('„Primăria” Iași!')).toBe('primaria iasi');
  });

  it('is idempotent and maps variants of the same institution to one key', () => {
    const a = normalizeInstitutionName('Primăria Municipiului Pitești');
    expect(normalizeInstitutionName(a)).toBe(a);
    expect(normalizeInstitutionName('primaria   municipiului PITESTI.')).toBe(a);
  });

  it('returns an empty string for blank / punctuation-only input', () => {
    expect(normalizeInstitutionName('')).toBe('');
    expect(normalizeInstitutionName('  ...  ')).toBe('');
  });
});
