/**
 * Decodarea „encoded-words" din headere (RFC 2047). Cazul din raportul de testare este
 * primul: subiectul sosea afişat ca `=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii...?=`.
 */
import { describe, it, expect } from 'vitest';
import { decodeEncodedWords } from '@m544/inbound/webhook/mime-words';

describe('decodeEncodedWords', () => {
  it('decodează cazul exact din raportul de testare', () => {
    expect(
      decodeEncodedWords('=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii_publice_-_Legea_544/2001?='),
    ).toBe('Re: Cerere informații publice - Legea 544/2001');
  });

  it('decodează base64 (encoding B)', () => {
    expect(decodeEncodedWords('=?UTF-8?B?UsSDc3B1bnMgbGEgY2VyZXJl?=')).toBe('Răspuns la cerere');
  });

  it('acceptă indicativul de encoding cu literă mică', () => {
    expect(decodeEncodedWords('=?utf-8?q?test_=C8=99i_diacritice?=')).toBe('test și diacritice');
  });

  it('uneşte encoded-words adiacente fără spaţiul dintre ele', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?Cerere_?= =?UTF-8?Q?informa=C8=9Bii?=')).toBe(
      'Cerere informații',
    );
  });

  it('păstrează spaţiul dintre un encoded-word şi text obişnuit', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?R=C4=83spuns?= la cererea dvs.')).toBe(
      'Răspuns la cererea dvs.',
    );
  });

  it('decodează ISO-8859-2 (instituţii cu servere vechi)', () => {
    // 0xE3 este ă în ISO-8859-2 (în ISO-8859-1 ar fi ã) — decodorul trebuie să respecte charsetul declarat.
    expect(decodeEncodedWords('=?iso-8859-2?Q?R=E3spuns?=')).toBe('Răspuns');
  });

  it('lasă textul simplu neschimbat', () => {
    expect(decodeEncodedWords('Cerere informații publice - Legea 544/2001')).toBe(
      'Cerere informații publice - Legea 544/2001',
    );
  });

  it('este idempotentă', () => {
    const once = decodeEncodedWords('=?UTF-8?Q?R=C4=83spuns?=');
    expect(decodeEncodedWords(once)).toBe(once);
  });

  it('lasă neatins un encoded-word cu charset necunoscut, în loc să arunce', () => {
    const input = '=?x-inventat?Q?ceva?=';
    expect(decodeEncodedWords(input)).toBe(input);
  });

  it('lasă neatins un encoded-word trunchiat', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?fara_terminator')).toBe('=?UTF-8?Q?fara_terminator');
  });

  it('tratează şirul gol', () => {
    expect(decodeEncodedWords('')).toBe('');
  });
});
