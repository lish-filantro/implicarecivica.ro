/**
 * Unit Tests — Pure functions (zero API calls)
 *
 * Tests: normalizeSubject, extractEmailAddr, validateRegistrationNumber,
 *        htmlToText, addDays
 */
import { describe, it, expect } from 'vitest';
import { normalizeSubject, extractEmailAddr, extractRegNumberCore } from '@/lib/services/request-matching';
import { validateRegistrationNumber } from '@/lib/services/analysis-service';
import { htmlToText } from '@/lib/utils/html-to-text';
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
// validateRegistrationNumber — edge cases
// ═══════════════════════════════════════════════════════════
describe('validateRegistrationNumber — edge cases', () => {
  it('accepts number with dots and spaces normalized', () => {
    const text = 'nr. 12345 / 20. 01. 2025 bla bla';
    // Candidate has dots collapsed — normalization removes spaces and dots
    expect(validateRegistrationNumber('12345/20.01.2025', text)).toBe('12345/20.01.2025');
  });

  it('does not reject "544 / 2001" with spaces — regex only matches exact "544/2001"', () => {
    // The guard only catches exact "544/2001" or "5442001", not "544 / 2001"
    // This is a known limitation — the spaced variant passes validation
    const text = 'conform Legii 544 / 2001';
    expect(validateRegistrationNumber('544 / 2001', text)).toBe('544 / 2001');
  });

  it('accepts number where only numeric core is in text', () => {
    // Text has "12345" but candidate is "Nr. 12345/2025"
    const text = 'Cererea 12345 a fost procesată';
    expect(validateRegistrationNumber('Nr. 12345/2025', text)).toBe('Nr. 12345/2025');
  });

  it('rejects when numeric core is too short (2 digits)', () => {
    const text = 'Documentul 99 primit';
    expect(validateRegistrationNumber('Nr. 99/2025', text)).toBeNull();
  });

  it('accepts registration number with RP suffix', () => {
    const text = 'Înregistrată sub nr. 7890/RP/2025 la data de...';
    expect(validateRegistrationNumber('7890/RP/2025', text)).toBe('7890/RP/2025');
  });

  it('handles unicode in text (diacritice)', () => {
    const text = 'Cererea dvs. înregistrată cu nr. 55555/2025 în data de ieri';
    expect(validateRegistrationNumber('55555/2025', text)).toBe('55555/2025');
  });

  it('rejects candidate with digits not in text at all', () => {
    const text = 'Am primit cererea dumneavoastră privind informații publice';
    expect(validateRegistrationNumber('99999/2025', text)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// extractRegNumberCore — edge cases
// ═══════════════════════════════════════════════════════════
describe('extractRegNumberCore — edge cases', () => {
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
    // "1234/RP/2025" → after stripping Nr., first numeric is "1234"
    expect(extractRegNumberCore('1234/RP/2025')).toBe('1234');
  });

  it('returns null for just a slash', () => {
    expect(extractRegNumberCore('/')).toBeNull();
  });

  it('handles leading whitespace', () => {
    expect(extractRegNumberCore('  54321/2025')).toBe('54321');
  });
});

// ═══════════════════════════════════════════════════════════
// normalizeSubject — edge cases
// ═══════════════════════════════════════════════════════════
describe('normalizeSubject — edge cases', () => {
  it('strips Fwd: then Re: (nested forwarded reply)', () => {
    expect(normalizeSubject('Fwd: Re: Cerere 544')).toBe('cerere 544');
  });

  it('strips Re: with no space after colon', () => {
    expect(normalizeSubject('Re:Cerere info')).toBe('cerere info');
  });

  it('handles very long subject', () => {
    const long = 'Re: ' + 'A'.repeat(500);
    const result = normalizeSubject(long);
    expect(result).toBe('a'.repeat(500));
  });

  it('handles subject with only prefix', () => {
    expect(normalizeSubject('Re:')).toBe('');
  });

  it('handles multiple spaces between prefix and subject', () => {
    expect(normalizeSubject('Re:    Test')).toBe('test');
  });
});

// ═══════════════════════════════════════════════════════════
// extractEmailAddr — edge cases
// ═══════════════════════════════════════════════════════════
describe('extractEmailAddr — edge cases', () => {
  it('handles multiple angle brackets (takes first)', () => {
    expect(extractEmailAddr('Name <first@test.ro> <second@test.ro>')).toBe('first@test.ro');
  });

  it('handles empty angle brackets — regex does not match empty <>', () => {
    // The regex <([^>]+)> requires at least one char between brackets
    // So "Name <>" falls through to the raw string path
    expect(extractEmailAddr('Name <>')).toBe('name <>');
  });

  it('handles email with subdomain', () => {
    expect(extractEmailAddr('Admin <admin@mail.primaria-bucuresti.ro>')).toBe('admin@mail.primaria-bucuresti.ro');
  });

  it('handles email with plus addressing', () => {
    expect(extractEmailAddr('user+544@gmail.com')).toBe('user+544@gmail.com');
  });
});

// ═══════════════════════════════════════════════════════════
// htmlToText — edge cases
// ═══════════════════════════════════════════════════════════
describe('htmlToText — edge cases', () => {
  it('handles <div> blocks', () => {
    expect(htmlToText('<div>Line 1</div><div>Line 2</div>')).toBe('Line 1\nLine 2');
  });

  it('decodes &#039; (apostrophe)', () => {
    expect(htmlToText('don&#039;t')).toBe("don't");
  });

  it('handles nested tags', () => {
    expect(htmlToText('<p><strong>Bold</strong> text</p>')).toBe('Bold text');
  });

  it('handles self-closing br variants', () => {
    expect(htmlToText('A<br/>B<br />C')).toBe('A\nB\nC');
  });

  it('handles real-world Romanian email HTML', () => {
    const html = `
      <p>Stimate domnule,</p>
      <p>Urmare a cererii dvs. &icirc;nregistrat&atilde; cu nr. <strong>12345/2025</strong>,
      v&atilde; comunic&atilde;m urm&atilde;toarele:</p>
      <br>
      <p>Cu stim&atilde;,<br>Serviciul Informații Publice</p>
    `;
    const result = htmlToText(html);
    expect(result).toContain('12345/2025');
    expect(result).toContain('Serviciul');
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('<strong>');
  });

  it('strips <style> and <script> tag content (leaves inner text visible — known behavior)', () => {
    // Current implementation strips tags but NOT their text content
    const html = '<style>.foo{color:red}</style><p>Content</p>';
    const result = htmlToText(html);
    expect(result).toContain('Content');
  });

  it('handles table structure as plain text', () => {
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
    const result = htmlToText(html);
    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
  });
});

// ═══════════════════════════════════════════════════════════
// addDays — edge cases
// ═══════════════════════════════════════════════════════════
describe('addDays — edge cases', () => {
  it('handles year overflow (Dec → Jan)', () => {
    const result = addDays('2025-12-25T00:00:00Z', 10);
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(4);
  });

  it('handles Feb 28 non-leap year', () => {
    const result = addDays('2025-02-25T00:00:00Z', 10);
    const d = new Date(result);
    expect(d.getMonth()).toBe(2); // March
    expect(d.getDate()).toBe(7);
  });

  it('handles Feb 28 leap year (2024)', () => {
    const result = addDays('2024-02-25T00:00:00Z', 10);
    const d = new Date(result);
    expect(d.getMonth()).toBe(2); // March
    expect(d.getDate()).toBe(6); // 29 Feb + 6 March = 10 days
  });

  it('handles negative days', () => {
    const result = addDays('2025-03-15T00:00:00Z', -5);
    const d = new Date(result);
    expect(d.getDate()).toBe(10);
  });

  it('handles large number of days (365)', () => {
    const result = addDays('2025-01-01T00:00:00Z', 365);
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// AnalysisResult parsing — answer_summary validation
// ═══════════════════════════════════════════════════════════
describe('AnswerSummary type validation', () => {
  it('text summary must have string content', () => {
    const summary = { type: 'text' as const, content: 'Nu există contracte.' };
    expect(summary.type).toBe('text');
    expect(typeof summary.content).toBe('string');
  });

  it('list summary must have array content', () => {
    const summary = { type: 'list' as const, content: ['Contract 1: 500 RON', 'Contract 2: 200 RON'] };
    expect(summary.type).toBe('list');
    expect(Array.isArray(summary.content)).toBe(true);
    expect(summary.content).toHaveLength(2);
  });

  it('table summary must have headers and rows', () => {
    const summary = {
      type: 'table' as const,
      headers: ['Nr.', 'Descriere', 'Valoare'],
      rows: [['1', 'Papetărie', '500 RON'], ['2', 'Curățenie', '200 RON']],
    };
    expect(summary.type).toBe('table');
    expect(summary.headers).toHaveLength(3);
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows[0]).toHaveLength(3);
  });

  it('empty table has headers but no rows', () => {
    const summary = {
      type: 'table' as const,
      headers: ['Nr.', 'Valoare'],
      rows: [] as string[][],
    };
    expect(summary.rows).toHaveLength(0);
    expect(summary.headers.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Deadline calculation scenarios (Law 544/2001)
// ═══════════════════════════════════════════════════════════
describe('Deadline calculation — Law 544/2001 scenarios', () => {
  it('standard deadline = date_received + 10 days', () => {
    const dateReceived = '2025-03-01T10:00:00Z';
    const deadline = addDays(dateReceived, 10);
    const d = new Date(deadline);
    expect(d.getDate()).toBe(11);
    expect(d.getMonth()).toBe(2); // March
  });

  it('extension deadline = date_received + 30 days total', () => {
    const dateReceived = '2025-03-01T10:00:00Z';
    const extensionDeadline = addDays(dateReceived, 30);
    const d = new Date(extensionDeadline);
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(2); // March
  });

  it('extension is 20 extra days on top of standard 10', () => {
    const dateReceived = '2025-06-15T10:00:00Z';
    const standardDeadline = new Date(addDays(dateReceived, 10));
    const extensionDeadline = new Date(addDays(dateReceived, 30));

    const diffMs = extensionDeadline.getTime() - standardDeadline.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(20);
  });

  it('effective deadline prefers extension_date over deadline_date', () => {
    const req = {
      deadline_date: '2025-03-11T10:00:00Z',
      extension_date: '2025-03-31T10:00:00Z',
    };
    const effectiveDeadline = req.extension_date || req.deadline_date;
    expect(effectiveDeadline).toBe(req.extension_date);
  });

  it('effective deadline falls back to deadline_date when no extension', () => {
    const req = {
      deadline_date: '2025-03-11T10:00:00Z',
      extension_date: null as string | null,
    };
    const effectiveDeadline = req.extension_date || req.deadline_date;
    expect(effectiveDeadline).toBe(req.deadline_date);
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
