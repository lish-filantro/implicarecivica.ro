/**
 * pipeline/analysis/registration — validateRegistrationNumber.
 * Same cases as the legacy tests in tests/unit/pure-functions.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { validateRegistrationNumber } from '@m544/pipeline/analysis/registration';

describe('validateRegistrationNumber', () => {
  it('accepts number that exists in source text', () => {
    const text = 'Cererea dvs. a fost înregistrată cu nr. 1234/RP/2025 din data...';
    expect(validateRegistrationNumber('1234/RP/2025', text)).toBe('1234/RP/2025');
  });

  it('rejects "544/2001" (the law number)', () => {
    expect(validateRegistrationNumber('544/2001', 'conform Legii 544/2001')).toBeNull();
  });

  it('rejects "5442001" variant', () => {
    expect(validateRegistrationNumber('5442001', 'legea 5442001')).toBeNull();
  });

  it('rejects number not found in text', () => {
    expect(validateRegistrationNumber('9999/2025', 'nr. 1234/2025 inregistrat')).toBeNull();
  });

  it('accepts via numeric part match', () => {
    expect(validateRegistrationNumber('Nr. 45678/2025', 'inregistrat cu 45678 la data')).toBe('Nr. 45678/2025');
  });

  it('rejects very short candidates (< 3 chars)', () => {
    expect(validateRegistrationNumber('12', 'nr 12 test')).toBeNull();
  });

  it('returns null for null and empty input', () => {
    expect(validateRegistrationNumber(null, 'some text')).toBeNull();
    expect(validateRegistrationNumber('', 'some text')).toBeNull();
  });

  it('trims result', () => {
    expect(validateRegistrationNumber('  1234/2025  ', 'nr. 1234/2025 din')).toBe('1234/2025');
  });

  it('accepts number with dots and spaces normalized', () => {
    const text = 'nr. 12345 / 20. 01. 2025 bla bla';
    expect(validateRegistrationNumber('12345/20.01.2025', text)).toBe('12345/20.01.2025');
  });

  it('does not reject "544 / 2001" with spaces (regex only matches the exact form)', () => {
    expect(validateRegistrationNumber('544 / 2001', 'legea 544 / 2001')).toBe('544 / 2001');
  });

  it('accepts number where only numeric core is in text', () => {
    expect(validateRegistrationNumber('Nr. 12345/2025', 'cererea 12345 a fost')).toBe('Nr. 12345/2025');
  });

  it('rejects when numeric core is too short (2 digits)', () => {
    expect(validateRegistrationNumber('Nr. 99/2025', 'cererea 99 a fost')).toBeNull();
  });

  it('accepts registration number with RP suffix', () => {
    expect(validateRegistrationNumber('7890/RP/2025', 'Nr. 7890/RP/2025 din 01.01.2025')).toBe('7890/RP/2025');
  });

  it('handles unicode in text (diacritice)', () => {
    expect(validateRegistrationNumber('55555/2025', 'Înregistrată cu nr. 55555/2025 în Șirul')).toBe('55555/2025');
  });

  it('rejects candidate with digits not in text at all', () => {
    expect(validateRegistrationNumber('99999/2025', 'text fara numere')).toBeNull();
  });

  it('is case-insensitive on the candidate', () => {
    expect(validateRegistrationNumber('ani-2024-789', 'Nr. ANI-2024-789')).toBe('ani-2024-789');
  });
});
