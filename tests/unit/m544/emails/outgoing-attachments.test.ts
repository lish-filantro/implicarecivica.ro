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

  it('nu face nimic fără ataşamente', async () => {
    expect(await loadAttachments([], storage({}))).toEqual({ ok: true, files: [] });
  });
});
