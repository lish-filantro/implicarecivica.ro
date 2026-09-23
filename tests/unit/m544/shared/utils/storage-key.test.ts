/**
 * shared/utils/storage-key — segmentul de cale din Supabase Storage pentru un nume de fişier.
 * Bucket-ul respinge cheile cu diacritice („Invalid key”) şi cu `%` („Bad Request”) — sondat
 * pe `email-attachments` pe 2026-09-23. Numele afişat rămâne neatins; doar cheia trece pe aici.
 */
import { describe, it, expect } from 'vitest';
import { storageKeyName } from '@m544/shared/utils/storage-key';

const ALLOWED = /^[A-Za-z0-9._() -]+$/;

describe('storageKeyName', () => {
  it('transliterează diacriticele româneşti', () => {
    expect(storageKeyName('Răspuns 544.pdf')).toBe('Raspuns 544.pdf');
  });

  it('tratează şi forma cu virgulă, şi cea cu sedilă, la majuscule şi minuscule', () => {
    expect(storageKeyName('ȘCOALĂ ţărână.png')).toBe('SCOALA tarana.png');
    expect(storageKeyName('Şcoală Ţară ÎÂ.pdf')).toBe('Scoala Tara IA.pdf');
  });

  it('scoate accentele altor limbi', () => {
    expect(storageKeyName('café über.pdf')).toBe('cafe uber.pdf');
  });

  it.each(['50%.pdf', 'Factura #3.pdf', 'ce?.pdf'])('nu lasă %% # ? în „%s”', (name) => {
    const key = storageKeyName(name);
    expect(key).not.toMatch(/[%#?]/);
    expect(key).toMatch(ALLOWED);
    expect(key.endsWith('.pdf')).toBe(true);
  });

  it.each(['😀😀.pdf', '报告.pdf', '📎 dovadă 😀.jpg', '😀'])('„%s” dă doar caractere permise, nevid, cu extensia', (name) => {
    const key = storageKeyName(name);
    expect(key).toMatch(ALLOWED);
    expect(key.length).toBeGreaterThan(0);
    const ext = /\.[a-z]+$/.exec(name)?.[0];
    if (ext) expect(key.endsWith(ext)).toBe(true);
  });

  it('un nume fără nimic permis devine „attachment”, cu extensia originală', () => {
    expect(storageKeyName('😀😀.pdf')).toBe('attachment.pdf');
    expect(storageKeyName('😀')).toBe('attachment');
  });

  it('strânge şirurile de _ şi taie spaţiile, punctele şi _ de la capete', () => {
    expect(storageKeyName('a%%%b.pdf')).toBe('a_b.pdf');
    expect(storageKeyName(' _.x y._ .pdf')).toBe('x y.pdf');
  });

  it('un nume de 300 de caractere se taie la 150 de unităţi, păstrând extensia', () => {
    const key = storageKeyName(`${'ă'.repeat(296)}.pdf`);
    expect(key.length).toBeLessThanOrEqual(150);
    expect(key.endsWith('.pdf')).toBe(true);
    expect(storageKeyName('😀'.repeat(150) + 'x'.repeat(300)).length).toBeLessThanOrEqual(150);
  });

  it.each([
    'Răspuns 544.pdf',
    'ȘCOALĂ ţărână.png',
    '50%.pdf',
    'Factura #3.pdf',
    '😀😀.pdf',
    'a.b😀',
    '.pdf',
    `${'x'.repeat(149)}.y.pdf`,
    `${'z'.repeat(300)}`,
    ' _.x y._ .pdf',
  ])('e idempotent pentru „%s”', (name) => {
    const once = storageKeyName(name);
    expect(storageKeyName(once)).toBe(once);
  });
});
