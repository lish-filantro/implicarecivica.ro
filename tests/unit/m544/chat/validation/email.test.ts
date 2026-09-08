/**
 * chat/validation/email — email extraction and the confidence scoring table:
 *   format +1 | .gov.ro +3 / .ro +1 | domain matches institution +2 |
 *   official source URL +2 | "544"/"transparen" in text +1 | institutional pattern +1
 *   0-3 low, 4-6 medium, 7+ high.
 */
import { describe, it, expect } from 'vitest';
import {
  extractEmails,
  isValidEmailFormat,
  isTrustedRomanianDomain,
  domainMatchesInstitution,
  scoreEmailConfidence,
} from '@m544/chat/validation/email';

describe('extractEmails', () => {
  it('finds, lower-cases and de-duplicates addresses', () => {
    expect(extractEmails('Scrie la Office@PrimariaPitesti.ro sau office@primariapitesti.ro; alt: cj@cjarges.ro.')).toEqual([
      'office@primariapitesti.ro',
      'cj@cjarges.ro',
    ]);
  });

  it('returns [] when there is none', () => {
    expect(extractEmails('nimic aici')).toEqual([]);
  });
});

describe('isValidEmailFormat', () => {
  it.each([
    ['a@b.ro', true],
    ['a@@b.ro', false],
    ['@b.ro', false],
    ['a@', false],
    ['a@bro', false],
    ['a..b@c.ro', false],
  ])('%s → %s', (email, ok) => {
    expect(isValidEmailFormat(email)).toBe(ok);
  });
});

describe('isTrustedRomanianDomain', () => {
  it('accepts .ro and .gov.ro only', () => {
    expect(isTrustedRomanianDomain('mai.gov.ro')).toBe(true);
    expect(isTrustedRomanianDomain('primariapitesti.ro')).toBe(true);
    expect(isTrustedRomanianDomain('gmail.com')).toBe(false);
  });
});

describe('domainMatchesInstitution', () => {
  it('matches on significant, diacritics-stripped words, skipping fillers', () => {
    expect(domainMatchesInstitution('contact@primariapitesti.ro', 'Primăria Municipiului Pitești')).toBe(true);
    expect(domainMatchesInstitution('x@gmail.com', 'Primăria Pitești')).toBe(false);
    expect(domainMatchesInstitution('x@municipiului.ro', 'Primăria Municipiului Pitești')).toBe(false);
    expect(domainMatchesInstitution('x@cjarges.ro', '')).toBe(false);
  });
});

describe('scoreEmailConfidence', () => {
  it('.gov.ro + official source + 544 context + known pattern → high', () => {
    const r = scoreEmailConfidence(
      'relatii.publice@mai.gov.ro',
      'Ministerul Afacerilor Interne',
      ['https://www.mai.gov.ro/legea-544'],
      'email legea 544 transparenta',
    );
    expect(r.confidence).toBe('high');
    expect(r.isGovRo).toBe(true);
    expect(r.isValid).toBe(true);
    expect(r.domain).toBe('mai.gov.ro');
    expect(r.domainMatchesInstitution).toBe(false);
    expect(r.confidenceReasons).toEqual([
      'Format email valid',
      'Domeniu .gov.ro (foarte de încredere)',
      'Sursa este un site oficial .ro',
      'Menționat în context Legea 544 / transparență',
      'Domeniu recunoscut ca instituțional',
    ]);
  });

  it('.ro + institution match + official source + pattern = 7 → high', () => {
    const r = scoreEmailConfidence('primaria@primariapitesti.ro', 'Primăria Pitești', ['https://primariapitesti.ro/contact'], 'contact');
    expect(r.confidence).toBe('high');
    expect(r.domainMatchesInstitution).toBe(true);
  });

  it('.ro + official source + pattern = 5 → medium', () => {
    const r = scoreEmailConfidence('secretariat@cjarges.ro', '', ['https://www.cjarges.ro/'], '');
    expect(r.confidence).toBe('medium');
  });

  it('.ro + pattern only = 3 → low (the STEP_2 warning case)', () => {
    const r = scoreEmailConfidence('office@primariapitesti.ro', '', [], '');
    expect(r.confidence).toBe('low');
    expect(r.confidenceReasons).toEqual(['Format email valid', 'Domeniu .ro', 'Domeniu recunoscut ca instituțional']);
  });

  it('non-.ro domain is flagged suspect and stays low', () => {
    const r = scoreEmailConfidence('info@gmail.com', 'Primăria Pitești', [], '');
    expect(r.confidence).toBe('low');
    expect(r.isGovRo).toBe(false);
    expect(r.confidenceReasons).toContain('Domeniu non-.ro (suspect)');
  });

  it('reports an invalid format', () => {
    const r = scoreEmailConfidence('bad@@x.ro', '', [], '');
    expect(r.isValid).toBe(false);
    expect(r.confidenceReasons[0]).toBe('Format email INVALID');
  });
});
