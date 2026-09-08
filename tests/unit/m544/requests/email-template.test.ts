/**
 * requests/email-template — the 544 request email body. The text must match the
 * legacy template byte for byte (it is what institutions receive and what
 * question extraction parses back).
 */
import { describe, it, expect } from 'vitest';
import { formatEmailBodyText, formatEmailBodyHtml, FIXED_SUBJECT } from '@m544/requests/email-template';

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
  'Stimate reprezentant al Primăria Municipiului Pitești,',
  '',
  'Subsemnatul Ion Popescu, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:',
  '',
  QUESTION,
  '',
  'Aștept cu interes răspunsul dumneavoastră la adresa de email ion.popescu@implicarecivica.ro și vă mulțumesc anticipat pentru cooperare.',
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
  it('produces the exact legacy plain-text body', () => {
    expect(formatEmailBodyText(QUESTION, data)).toBe(EXPECTED_TEXT);
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
