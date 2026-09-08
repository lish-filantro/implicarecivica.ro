/**
 * requests/utils/question-extraction — text cleanup and question extraction
 * from request bodies (Romanian 544 templates).
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  formatSummary,
  truncateText,
  extractTemplateQuestion,
  extractKeyLines,
  getRequestQuestion,
} from '@m544/requests/utils/question-extraction';
import { formatEmailBodyText } from '@m544/requests/email-template';
import type { Request } from '@m544/shared/types/request';

const baseRequest: Request = {
  id: 'r1',
  user_id: 'u1',
  institution_name: 'Primăria Pitești',
  subject: 'Cerere informații publice - Legea 544/2001',
  status: 'pending',
  date_initiated: '2026-09-01T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const QUESTION = 'Vă rog să îmi comunicați numărul autorizațiilor de construire emise în anul 2025.';

const solicitant = {
  solicitantName: 'Ion Popescu',
  solicitantAddress: 'Str. Libertății nr. 4, Pitești',
  solicitantEmail: 'ion.popescu@implicarecivica.ro',
  institutionName: 'Primăria Municipiului Pitești',
};

describe('sanitizeText', () => {
  it('returns "" for null/undefined', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('normalizes CRLF and nbsp, trims lines and drops blank ones', () => {
    expect(sanitizeText('  Solicitare:\r\n\r\n Vă rog  \r\n\n')).toBe('Solicitare:\nVă rog');
  });
});

describe('formatSummary', () => {
  it('collapses newlines and runs of spaces to one line', () => {
    expect(formatSummary('Vă rog \n  să îmi   comunicați\n\nbugetul.')).toBe('Vă rog să îmi comunicați bugetul.');
  });

  it('returns "" for empty input', () => {
    expect(formatSummary('')).toBe('');
  });
});

describe('truncateText', () => {
  it('leaves short text untouched (trimmed)', () => {
    expect(truncateText('  scurt  ')).toBe('scurt');
  });

  it('cuts at the limit, trims trailing space and appends "..."', () => {
    expect(truncateText('abcdef ghij', 7)).toBe('abcdef...');
    expect(truncateText('a'.repeat(300))).toBe(`${'a'.repeat(220)}...`);
  });

  it('returns "" for empty input', () => {
    expect(truncateText('')).toBe('');
  });
});

describe('extractTemplateQuestion', () => {
  it('extracts the block after "Solicitare:" up to "Aștept"', () => {
    const body = `Stimate domn,\n\nSolicitare:\n${QUESTION}\nDe asemenea, lista lor.\n\nAștept cu interes răspunsul.`;
    expect(extractTemplateQuestion(body)).toBe(`${QUESTION}\nDe asemenea, lista lor.`);
  });

  it('extracts the question from the full 544 email template', () => {
    const body = formatEmailBodyText(QUESTION, solicitant);
    expect(extractTemplateQuestion(body)).toBe(QUESTION);
  });

  it('handles the long form ending in "Cu stimă"', () => {
    const body =
      'în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:\n' +
      'Care este valoarea contractelor de deszăpezire din 2024?\nCu stimă,\nIon';
    expect(extractTemplateQuestion(body)).toBe('Care este valoarea contractelor de deszăpezire din 2024?');
  });

  it('falls back to the first line containing a question mark', () => {
    expect(extractTemplateQuestion('Bună ziua,\nCâte locuri de parcare există?\nMulțumesc')).toBe(
      'Câte locuri de parcare există?',
    );
  });

  it('returns "" when nothing matches or input is empty', () => {
    expect(extractTemplateQuestion('Bună ziua. Mulțumesc.')).toBe('');
    expect(extractTemplateQuestion(null)).toBe('');
  });
});

describe('extractKeyLines', () => {
  const body = [
    'Solicitant: Ion Popescu',
    'Stimate reprezentant al Primăriei,',
    'Câte autorizații de construire ați emis în 2025?',
    '- lista contractelor de deszăpezire',
    'Cu stimă,',
    'Ion Popescu',
  ].join('\n');

  it('ranks questions and bullets above polite formulas and contact lines', () => {
    const lines = extractKeyLines(body).split('\n');
    expect(lines[0]).toBe('Câte autorizații de construire ați emis în 2025?');
    expect(lines[1]).toBe('- lista contractelor de deszăpezire');
    expect(lines).not.toContain('Solicitant: Ion Popescu');
    expect(lines).not.toContain('Cu stimă,');
  });

  it('honours maxLines', () => {
    expect(extractKeyLines(body, { maxLines: 1 })).toBe('Câte autorizații de construire ați emis în 2025?');
  });

  it('favorQuestions boosts question lines over keyword-heavy lines', () => {
    // keywords: solicit + informa + registr = 6; question + registr = 5 without the boost, 8 with it
    const text = 'Solicit informații privind registrul\nUnde se află registrul?';
    expect(extractKeyLines(text, { maxLines: 1 })).toBe('Solicit informații privind registrul');
    expect(extractKeyLines(text, { favorQuestions: true, maxLines: 1 })).toBe('Unde se află registrul?');
  });

  it('returns "" for empty input', () => {
    expect(extractKeyLines('')).toBe('');
    expect(extractKeyLines(null)).toBe('');
  });
});

describe('getRequestQuestion', () => {
  it('uses the template in request_body first and collapses it to one line', () => {
    const request_body = formatEmailBodyText(`${QUESTION}\nȘi lista lor.`, solicitant);
    expect(getRequestQuestion({ ...baseRequest, request_body })).toBe(`${QUESTION} Și lista lor.`);
  });

  it('a plain question stored as request_body comes back unchanged', () => {
    expect(getRequestQuestion({ ...baseRequest, request_body: 'Care este bugetul pe 2026?' })).toBe(
      'Care este bugetul pe 2026?',
    );
  });

  it('falls back to body, then to key-line scoring, then to summary', () => {
    expect(getRequestQuestion({ ...baseRequest, body: 'Bună,\nCâte angajați aveți?\nMulțumesc' })).toBe(
      'Câte angajați aveți?',
    );
    expect(getRequestQuestion({ ...baseRequest, request_body: 'Solicit lista contractelor din 2025.' })).toBe(
      'Solicit lista contractelor din 2025.',
    );
    expect(getRequestQuestion({ ...baseRequest, summary: 'Rezumat salvat' })).toBe('Rezumat salvat');
  });

  it('returns "" when there is nothing to extract', () => {
    expect(getRequestQuestion(baseRequest)).toBe('');
  });
});
