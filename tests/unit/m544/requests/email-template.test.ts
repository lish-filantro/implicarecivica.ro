/**
 * requests/email-template — the 544 request email body. The text is fixed byte for
 * byte (it is what institutions receive and what question extraction parses back).
 * Rewritten on 2026-09-22 after the testing report: gendered "Subsemnata", the
 * usual "cu domiciliul în …", an invariable salutation and the thanks on their own
 * line. Question extraction accepts both wordings — see question-extraction.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  emailBodyLines,
  formatEmailBodyText,
  formatEmailBodyHtml,
  FIXED_SUBJECT,
} from '@m544/requests/email-template';

const data = {
  solicitantName: 'Ion Popescu',
  solicitantAddress: 'Str. Libertății nr. 4, Pitești',
  solicitantEmail: 'ion.popescu@implicarecivica.ro',
  institutionName: 'Primăria Municipiului Pitești',
  // extra wizard fields must be accepted (WizardFormData is a superset)
  institutionEmail: 'registratura@primaria-pitesti.ro',
  saveAddress: true,
  sessionName: '',
};
const QUESTION = 'Vă rog să îmi comunicați numărul autorizațiilor de construire emise în anul 2025.';

const EXPECTED_TEXT = [
  'Solicitant: Ion Popescu',
  'Adresa: Str. Libertății nr. 4, Pitești',
  'Email: ion.popescu@implicarecivica.ro',
  '',
  'Stimată doamnă/Stimate domn,',
  '',
  'Subsemnatul/Subsemnata Ion Popescu, cu domiciliul în Str. Libertății nr. 4, Pitești, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:',
  '',
  QUESTION,
  '',
  'Aștept cu interes răspunsul dumneavoastră la adresa de email ion.popescu@implicarecivica.ro.',
  '',
  'Vă mulțumesc anticipat pentru cooperare.',
  '',
  '',
  'Cu stimă,',
  'Ion Popescu',
].join('\n');

describe('FIXED_SUBJECT', () => {
  it('is the legacy subject', () => {
    expect(FIXED_SUBJECT).toBe('Cerere informații publice - Legea 544/2001');
  });
});

describe('formatEmailBodyText', () => {
  it('produces the exact plain-text body', () => {
    expect(formatEmailBodyText(QUESTION, data)).toBe(EXPECTED_TEXT);
  });

  it('foloseşte „Subsemnata" pentru o solicitantă', () => {
    const text = formatEmailBodyText(QUESTION, { ...data, solicitantGender: 'f' as const });
    expect(text).toContain('Subsemnata Ion Popescu, cu domiciliul în Str. Libertății nr. 4, Pitești,');
    expect(text).not.toContain('Subsemnatul/Subsemnata');
  });

  it('foloseşte „Subsemnatul" pentru un solicitant', () => {
    const text = formatEmailBodyText(QUESTION, { ...data, solicitantGender: 'm' as const });
    expect(text).toContain('Subsemnatul Ion Popescu, cu domiciliul în');
    expect(text).not.toContain('Subsemnatul/Subsemnata');
  });

  it('foloseşte forma dublă când genul lipseşte (conturi de dinainte de migrarea 019)', () => {
    expect(formatEmailBodyText(QUESTION, { ...data, solicitantGender: null })).toContain(
      'Subsemnatul/Subsemnata Ion Popescu,',
    );
  });

  it('se adresează invariabil, fără acord cu numele instituţiei', () => {
    const text = formatEmailBodyText(QUESTION, data);
    expect(text).toContain('Stimată doamnă/Stimate domn,');
    expect(text).not.toContain('Stimate reprezentant al');
  });
});

describe('emailBodyLines', () => {
  it('separă mulţumirile de propoziţia cu adresa de răspuns', () => {
    const lines = emailBodyLines(QUESTION, data);
    expect(lines.find((l) => l.includes('mulțumesc'))).toBe('Vă mulțumesc anticipat pentru cooperare.');
    expect(
      lines.some((l) => l.includes('Aștept cu interes răspunsul') && l.includes('mulțumesc')),
    ).toBe(false);
  });
});

describe('formatEmailBodyHtml', () => {
  it('joins the same lines with <br>, turning empty lines into <br>', () => {
    const expected = EXPECTED_TEXT.split('\n')
      .map((line) => line || '<br>')
      .join('<br>\n');
    expect(formatEmailBodyHtml(QUESTION, data)).toBe(expected);
  });

  it('keeps the question verbatim (no escaping, as before)', () => {
    expect(formatEmailBodyHtml('Câte "autorizații" & avize?', data)).toContain('Câte "autorizații" & avize?');
  });
});
