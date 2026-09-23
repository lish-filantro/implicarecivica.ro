/**
 * Descărcarea şi verificarea ataşamentelor înainte de trimitere. Octeţii decid tipul şi
 * mărimea, nu ce a declarat browserul.
 */
import { describe, it, expect } from 'vitest';
import { loadAttachments } from '@m544/emails/outgoing-attachments';
import type { OutgoingAttachment } from '@m544/requests/attachments';

const PDF = new TextEncoder().encode('%PDF-1.4 test');
const att = (over: Partial<OutgoingAttachment> = {}): OutgoingAttachment => ({
  path: 'u1/outgoing/id1/doc.pdf',
  name: 'doc.pdf',
  type: 'application/pdf',
  size: PDF.byteLength,
  ...over,
});
const storage = (files: Record<string, Uint8Array>) => ({ download: async (p: string) => files[p] ?? null });

describe('loadAttachments', () => {
  it('descarcă, stabileşte tipul după octeţi şi păstrează calea pentru metadate', async () => {
    const r = await loadAttachments([att({ type: 'image/png' })], storage({ 'u1/outgoing/id1/doc.pdf': PDF }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].contentType).toBe('application/pdf');
    expect(r.files[0].content.equals(Buffer.from(PDF))).toBe(true);
    expect(r.files[0].meta).toEqual({ path: 'u1/outgoing/id1/doc.pdf', name: 'doc.pdf', type: 'application/pdf', size: PDF.byteLength });
  });

  it('eşuează, numind fişierul, când obiectul nu mai există în storage', async () => {
    const r = await loadAttachments([att()], storage({}));
    expect(r).toEqual({ ok: false, error: expect.stringContaining('doc.pdf') });
  });

  it('eşuează pe un fişier care nu e imagine sau PDF, oricum s-ar numi', async () => {
    const exe = new TextEncoder().encode('MZ\x90\0');
    const r = await loadAttachments([att()], storage({ 'u1/outgoing/id1/doc.pdf': exe }));
    expect(r.ok).toBe(false);
  });

  it('eşuează după mărimea REALĂ, chiar dacă cea declarată e mică (Review Focus 1)', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    const r = await loadAttachments([att({ size: 10 })], storage({ 'u1/outgoing/id1/doc.pdf': big }));
    expect(r.ok).toBe(false);
  });

  it('spune mărimea fişierului prea mare, cu aceleaşi cuvinte ca browserul', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    const r = await loadAttachments([att({ size: 10 })], storage({ 'u1/outgoing/id1/doc.pdf': big }));
    expect(r).toEqual({ ok: false, error: '„doc.pdf” are 10,0 MB; maximum 10,0 MB pe fișier.' });
  });

  it('spune suma când împreună trec de 20 MB', async () => {
    const eight = new Uint8Array(8 * 1024 * 1024);
    eight.set(PDF);
    const list = ['a', 'b', 'c'].map((n) => att({ path: `u1/outgoing/${n}/${n}.pdf`, name: `${n}.pdf` }));
    const r = await loadAttachments(list, storage(Object.fromEntries(list.map((a) => [a.path, eight]))));
    expect(r).toEqual({ ok: false, error: 'Împreună, fișierele au 24,0 MB; maximum 20,0 MB pe întrebare.' });
  });

  it('nu face nimic fără ataşamente', async () => {
    expect(await loadAttachments([], storage({}))).toEqual({ ok: true, files: [] });
  });
});

describe('loadAttachments — numele fişierului (Final fix F2)', () => {
  // Numele vine din cerere, deci din orice POST direct: serverul îl curăţă singur şi îi pune
  // extensia tipului citit din octeţi, ca un PDF/HTML poliglot să nu plece drept „factura.html".
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  async function nameFor(name: string, bytes: Uint8Array = PDF) {
    const r = await loadAttachments([att({ name })], storage({ 'u1/outgoing/id1/doc.pdf': bytes }));
    if (!r.ok) throw new Error(r.error);
    expect(r.files[0].meta.name).toBe(r.files[0].filename);
    return r.files[0].filename;
  }

  it('taie directoarele şi adaugă extensia tipului real', async () => {
    expect(await nameFor('../x.html')).toBe('x.html.pdf');
    expect(await nameFor('x.exe')).toBe('x.exe.pdf');
    expect(await nameFor('poza.png', JPEG)).toBe('poza.png.jpg');
  });

  it('lasă neatins un nume corect, inclusiv .jpeg şi extensia cu majuscule', async () => {
    expect(await nameFor('doc.pdf')).toBe('doc.pdf');
    expect(await nameFor('Răspuns 544.PDF')).toBe('Răspuns 544.PDF');
    expect(await nameFor('poza.jpeg', JPEG)).toBe('poza.jpeg');
    expect(await nameFor('poza.jpg', JPEG)).toBe('poza.jpg');
  });

  it('scoate caracterele de control', async () => {
    expect(await nameFor('do\u0007c\u0000.pdf')).toBe('doc.pdf');
  });

  it('limitează numele la 150 de caractere, păstrând extensia', async () => {
    const long = await nameFor(`${'a'.repeat(296)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(150);
    expect(long.endsWith('.pdf')).toBe(true);
    const noExt = await nameFor('b'.repeat(300));
    expect(noExt.length).toBeLessThanOrEqual(150);
    expect(noExt.endsWith('.pdf')).toBe(true);
  });
});
