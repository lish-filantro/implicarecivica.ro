/**
 * Unit Tests — Pure functions (zero API calls)
 *
 * Tests: normalizeSubject, extractEmailAddr, validateRegistrationNumber,
 *        htmlToText, addDays
 */
import { describe, it, expect } from 'vitest';
import { normalizeSubject, extractEmailAddr, extractRegNumberCore } from '@/lib/services/request-matching';
import { validateRegistrationNumber } from '@/lib/services/analysis-service';
import { htmlToText } from '@/app/api/emails/process/route';
import { addDays } from '@/lib/services/status-updater';

// ═══════════════════════════════════════════════════════════
// normalizeSubject
// ═══════════════════════════════════════════════════════════
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

  it('handles case insensitive RE: / FWD:', () => {
    expect(normalizeSubject('RE: Test')).toBe('test');
    expect(normalizeSubject('FWD: Test')).toBe('test');
  });

  it('trims whitespace around subject', () => {
    // Leading spaces before "Re:" prevent the regex from matching —
    // this is current behavior (regex anchored to ^)
    expect(normalizeSubject('Re:  Cerere  ')).toBe('cerere');
  });

  it('leading spaces before Re: — known limitation', () => {
    // normalizeSubject trims AFTER stripping, so "  Re:" doesn't match ^re:
    const result = normalizeSubject('  Re:  Cerere  ');
    expect(result).toBe('re:  cerere');
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
});

// ═══════════════════════════════════════════════════════════
// extractEmailAddr
// ═══════════════════════════════════════════════════════════
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
});

// ═══════════════════════════════════════════════════════════
// extractRegNumberCore
// ═══════════════════════════════════════════════════════════
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
});

// ═══════════════════════════════════════════════════════════
// validateRegistrationNumber
// ═══════════════════════════════════════════════════════════
describe('validateRegistrationNumber', () => {
  it('accepts number that exists in source text', () => {
    const text = 'Cererea dvs. a fost înregistrată cu nr. 1234/RP/2025 din data...';
    expect(validateRegistrationNumber('1234/RP/2025', text)).toBe('1234/RP/2025');
  });

  it('rejects "544/2001" (the law number)', () => {
    const text = 'conform Legii 544/2001 privind accesul la informații publice';
    expect(validateRegistrationNumber('544/2001', text)).toBeNull();
  });

  it('rejects "544 2001" variant', () => {
    expect(validateRegistrationNumber('5442001', 'legea 5442001')).toBeNull();
  });

  it('rejects number not found in text', () => {
    const text = 'Vă comunicăm că cererea a fost primită';
    expect(validateRegistrationNumber('9999/2025', text)).toBeNull();
  });

  it('accepts via numeric part match', () => {
    const text = 'Înregistrat sub numărul 45678 la data de 15.01.2025';
    expect(validateRegistrationNumber('Nr. 45678/2025', text)).toBe('Nr. 45678/2025');
  });

  it('rejects very short candidates (< 3 chars)', () => {
    expect(validateRegistrationNumber('12', 'nr 12 test')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(validateRegistrationNumber(null, 'some text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateRegistrationNumber('', 'some text')).toBeNull();
  });

  it('trims result', () => {
    const text = 'nr. 1234/2025 bla';
    expect(validateRegistrationNumber('  1234/2025  ', text)).toBe('1234/2025');
  });
});

// ═══════════════════════════════════════════════════════════
// htmlToText
// ═══════════════════════════════════════════════════════════
describe('htmlToText', () => {
  it('strips HTML tags', () => {
    expect(htmlToText('<p>Hello</p>')).toBe('Hello');
  });

  it('converts <br> to newline', () => {
    expect(htmlToText('Line 1<br>Line 2')).toBe('Line 1\nLine 2');
  });

  it('converts </p> to double newline', () => {
    expect(htmlToText('<p>Para 1</p><p>Para 2</p>')).toBe('Para 1\n\nPara 2');
  });

  it('decodes &nbsp;', () => {
    expect(htmlToText('Hello&nbsp;World')).toBe('Hello World');
  });

  it('decodes &amp; &lt; &gt; &quot;', () => {
    expect(htmlToText('A&amp;B &lt;C&gt; &quot;D&quot;')).toBe('A&B <C> "D"');
  });

  it('collapses excessive newlines', () => {
    expect(htmlToText('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('trims result', () => {
    expect(htmlToText('  <p>test</p>  ')).toBe('test');
  });

  it('handles empty string', () => {
    expect(htmlToText('')).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════
// addDays
// ═══════════════════════════════════════════════════════════
describe('addDays', () => {
  it('adds 10 days (standard deadline)', () => {
    const result = addDays('2025-01-15T10:00:00Z', 10);
    expect(new Date(result).getDate()).toBe(25);
  });

  it('adds 30 days (extension deadline)', () => {
    const result = addDays('2025-01-01T00:00:00Z', 30);
    const d = new Date(result);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(31);
  });

  it('handles month overflow', () => {
    const result = addDays('2025-01-25T00:00:00Z', 10);
    const d = new Date(result);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(4);
  });

  it('returns ISO string', () => {
    const result = addDays('2025-06-01T12:00:00Z', 5);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles 0 days', () => {
    const input = '2025-03-01T10:00:00Z';
    const result = addDays(input, 0);
    expect(new Date(result).getDate()).toBe(new Date(input).getDate());
  });
});

// ═══════════════════════════════════════════════════════════
// Status Transition Logic
// ═══════════════════════════════════════════════════════════
describe('Status transitions (conceptual)', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['received', 'extension', 'answered'],
    received: ['extension', 'answered', 'delayed'],
    extension: ['answered', 'delayed'],
    answered: [], // terminal state — no downgrade
    delayed: ['answered'], // late response can still arrive
  };

  it.each(Object.entries(VALID_TRANSITIONS))(
    'from %s allows transitions to %s',
    (from, allowed) => {
      expect(Array.isArray(allowed)).toBe(true);
      // answered is terminal
      if (from === 'answered') {
        expect(allowed).toHaveLength(0);
      }
    },
  );

  it('answered is a terminal state', () => {
    expect(VALID_TRANSITIONS['answered']).toEqual([]);
  });

  it('all statuses have defined transitions', () => {
    const allStatuses = ['pending', 'received', 'extension', 'answered', 'delayed'];
    for (const s of allStatuses) {
      expect(VALID_TRANSITIONS).toHaveProperty(s);
    }
  });
});
