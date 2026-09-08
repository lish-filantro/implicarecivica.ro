/**
 * pipeline/matching/normalize — pure helpers shared by the matching strategies.
 * Cases mirror tests/unit/pure-functions.test.ts (the legacy module) so the
 * behaviour is provably identical, plus a few extra edge cases.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSubject, extractEmailAddr, extractRegNumberCore } from '@m544/pipeline/matching';

describe('normalizeSubject', () => {
  it('strips Re: prefix', () => {
    expect(normalizeSubject('Re: Cerere informații publice')).toBe('cerere informații publice');
  });
  it('strips Fwd: prefix', () => {
    expect(normalizeSubject('Fwd: Cerere 544')).toBe('cerere 544');
  });
  it('strips Fw: prefix', () => {
    expect(normalizeSubject('Fw: Solicitare date')).toBe('solicitare date');
  });
  it('strips Răspuns: prefix (Romanian)', () => {
    expect(normalizeSubject('Răspuns: Cerere nr. 123')).toBe('cerere nr. 123');
  });
  it('strips nested Re: Re: prefixes', () => {
    expect(normalizeSubject('Re: Re: Cerere informatii')).toBe('cerere informatii');
  });
  it('strips Fwd: then Re: (nested forwarded reply)', () => {
    expect(normalizeSubject('Fwd: Re: Cerere 544')).toBe('cerere 544');
  });
  it('handles case insensitive RE: / FWD:', () => {
    expect(normalizeSubject('RE: Test')).toBe('test');
    expect(normalizeSubject('FWD: Test')).toBe('test');
  });
  it('trims whitespace around subject', () => {
    expect(normalizeSubject('Re:  Cerere  ')).toBe('cerere');
  });
  it('leading spaces before Re: — known limitation (regex anchored to ^)', () => {
    expect(normalizeSubject('  Re:  Cerere  ')).toBe('re:  cerere');
  });
  it('returns lowercase', () => {
    expect(normalizeSubject('CERERE INFORMAȚII PUBLICE')).toBe('cerere informații publice');
  });
  it('handles empty string', () => {
    expect(normalizeSubject('')).toBe('');
  });
  it('handles subject without prefix', () => {
    expect(normalizeSubject('Cerere normală')).toBe('cerere normală');
  });
  it('strips Re: with no space after colon', () => {
    expect(normalizeSubject('Re:Cerere info')).toBe('cerere info');
  });
  it('handles very long subject', () => {
    expect(normalizeSubject('Re: ' + 'A'.repeat(500))).toBe('a'.repeat(500));
  });
  it('handles subject with only prefix', () => {
    expect(normalizeSubject('Re:')).toBe('');
  });
  it('handles multiple spaces between prefix and subject', () => {
    expect(normalizeSubject('Re:    Test')).toBe('test');
  });
  it('strips at most two prefixes (legacy behaviour)', () => {
    expect(normalizeSubject('Re: Re: Re: X')).toBe('re: x');
  });
});

describe('extractEmailAddr', () => {
  it('extracts from RFC 5322 format with display name', () => {
    expect(extractEmailAddr('Ion Popescu <ion@domain.ro>')).toBe('ion@domain.ro');
  });
  it('handles plain email without angle brackets', () => {
    expect(extractEmailAddr('test@example.com')).toBe('test@example.com');
  });
  it('returns lowercase', () => {
    expect(extractEmailAddr('Test@DOMAIN.RO')).toBe('test@domain.ro');
  });
  it('trims whitespace', () => {
    expect(extractEmailAddr('  test@domain.ro  ')).toBe('test@domain.ro');
  });
  it('handles complex display names', () => {
    expect(extractEmailAddr('"Primăria Sector 3" <registratura@ps3.ro>')).toBe('registratura@ps3.ro');
  });
  it('handles display name with special chars', () => {
    expect(extractEmailAddr('Ștefan Ionescu <stefan@gov.ro>')).toBe('stefan@gov.ro');
  });
  it('handles multiple angle brackets (takes first)', () => {
    expect(extractEmailAddr('Name <first@test.ro> <second@test.ro>')).toBe('first@test.ro');
  });
  it('handles empty angle brackets — falls through to the raw string', () => {
    expect(extractEmailAddr('Name <>')).toBe('name <>');
  });
  it('handles email with subdomain', () => {
    expect(extractEmailAddr('Admin <admin@mail.primaria-bucuresti.ro>')).toBe('admin@mail.primaria-bucuresti.ro');
  });
  it('handles email with plus addressing', () => {
    expect(extractEmailAddr('user+544@gmail.com')).toBe('user+544@gmail.com');
  });
  it('handles empty string', () => {
    expect(extractEmailAddr('')).toBe('');
  });
});

describe('extractRegNumberCore', () => {
  it('extracts core from number/date format', () => {
    expect(extractRegNumberCore('29702/14.11.2025')).toBe('29702');
  });
  it('extracts core from Nr. prefix format', () => {
    expect(extractRegNumberCore('Nr. 31884 / 01.12.2025')).toBe('31884');
  });
  it('extracts core from space-separated format', () => {
    expect(extractRegNumberCore('54455 / 19.11.2025')).toBe('54455');
  });
  it('extracts core from bare number', () => {
    expect(extractRegNumberCore('29702')).toBe('29702');
  });
  it('returns null for short numbers', () => {
    expect(extractRegNumberCore('12')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(extractRegNumberCore('')).toBeNull();
  });
  it('matches same core despite different dates', () => {
    const core1 = extractRegNumberCore('29702/14.11.2025');
    const core2 = extractRegNumberCore('29702/22.11.2025');
    const core3 = extractRegNumberCore('29702/04.12.2025');
    expect(core1).toBe(core2);
    expect(core2).toBe(core3);
  });
  it('handles Nr. with dot and mixed case', () => {
    expect(extractRegNumberCore('NR. 45678/2025')).toBe('45678');
  });
  it('handles Nr without dot', () => {
    expect(extractRegNumberCore('Nr 12345')).toBe('12345');
  });
  it('handles nr lowercase', () => {
    expect(extractRegNumberCore('nr.67890/01.02.2025')).toBe('67890');
  });
  it('returns null for text-only input', () => {
    expect(extractRegNumberCore('abc')).toBeNull();
  });
  it('extracts from complex format with RP', () => {
    expect(extractRegNumberCore('1234/RP/2025')).toBe('1234');
  });
  it('returns null for just a slash', () => {
    expect(extractRegNumberCore('/')).toBeNull();
  });
  it('handles leading whitespace', () => {
    expect(extractRegNumberCore('  54321/2025')).toBe('54321');
  });
  it('returns exactly three digits (boundary of the >= 3 rule)', () => {
    expect(extractRegNumberCore('123/2025')).toBe('123');
  });
});
