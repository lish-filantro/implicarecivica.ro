/**
 * Verificările comune browserului şi serverului pentru ataşamentele unei întrebări.
 * Spec: docs/plans/2026-09-23-atasamente-design.md §4.1-4.2.
 */
import { describe, it, expect } from 'vitest';
import {
  checkDeclaredAttachments,
  checkNewAttachment,
  formatMb,
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENTS_BYTES_PER_QUESTION,
  MAX_ATTACHMENTS_PER_QUESTION,
  outgoingPath,
  sniffAttachmentType,
  type OutgoingAttachment,
} from '@m544/requests/attachments';

const MB = 1024 * 1024;
const att = (over: Partial<OutgoingAttachment> = {}): OutgoingAttachment => ({
  path: 'u1/outgoing/id1/doc.pdf',
  name: 'doc.pdf',
  type: 'application/pdf',
  size: 1 * MB,
  ...over,
});

describe('outgoingPath', () => {
  it('pune fişierul sub folderul RLS al utilizatorului', () => {
    expect(outgoingPath('u1', 'id1', 'Răspuns 544.pdf')).toBe('u1/outgoing/id1/Răspuns 544.pdf');
  });

  it('nu lasă numele să iasă din folder (Review Focus 2)', () => {
    const p = outgoingPath('u1', 'id1', '../../u2/outgoing/x/evil.pdf');
    expect(p.startsWith('u1/outgoing/id1/')).toBe(true);
    expect(p.split('/')).not.toContain('..');
  });
});

describe('checkNewAttachment', () => {
  it('acceptă o imagine în limite', () => {
    expect(checkNewAttachment([], { name: 'groapa.jpg', type: 'image/jpeg', size: 2 * MB })).toBeNull();
  });

  it('refuză un tip neacceptat', () => {
    expect(checkNewAttachment([], { name: 'a.docx', type: 'application/msword', size: 10 })).toMatch(/nu e acceptat/);
  });

  it('refuză un fişier peste 10 MB', () => {
    expect(
      checkNewAttachment([], { name: 'mare.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_FILE_BYTES + 1 }),
    ).toMatch(/pe fișier/);
  });

  it('refuză al şaselea fişier', () => {
    const existing = Array.from({ length: MAX_ATTACHMENTS_PER_QUESTION }, () => ({ size: 1 }));
    expect(checkNewAttachment(existing, { name: 'x.png', type: 'image/png', size: 1 })).toMatch(/Cel mult 5/);
  });

  it('refuză depăşirea celor 20 MB pe întrebare', () => {
    const existing = [{ size: 9 * MB }, { size: 9 * MB }];
    expect(checkNewAttachment(existing, { name: 'x.pdf', type: 'application/pdf', size: 3 * MB })).toMatch(/pe întrebare/);
    expect(MAX_ATTACHMENTS_BYTES_PER_QUESTION).toBe(20 * MB);
  });
});

describe('checkDeclaredAttachments', () => {
  it('acceptă ataşamente proprii în limite', () => {
    expect(checkDeclaredAttachments('u1', [att()])).toBeNull();
  });

  it('refuză o cale din folderul altcuiva', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u2/outgoing/id1/doc.pdf' })])).toMatch(/nepermis/);
  });

  it('refuză o cale în afara lui outgoing/', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/e9/raspuns.pdf' })])).toMatch(/nepermis/);
  });

  it('refuză segmentele „..", dar nu un nume care conţine două puncte', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/outgoing/../u2/x.pdf' })])).toMatch(/nepermis/);
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/outgoing/id1/raport..final.pdf' })])).toBeNull();
  });

  it.each([
    ['%', 'u1/outgoing/id1/%2e%2e/doc.pdf'],
    ['\\', 'u1/outgoing/id1\\..\\doc.pdf'],
    ['?', 'u1/outgoing/id1/doc.pdf?x=1'],
    ['#', 'u1/outgoing/id1/doc.pdf#x'],
    ['un segment gol', 'u1/outgoing//doc.pdf'],
  ])('refuză o cale cu %s (apărare în adâncime)', (_label, path) => {
    expect(checkDeclaredAttachments('u1', [att({ path })])).toMatch(/nepermis/);
  });

  it('mesajele pun numele între ghilimele româneşti închise corect', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u2/outgoing/id1/doc.pdf' })])).toBe('Fișier nepermis: „doc.pdf”.');
    expect(checkNewAttachment([], { name: 'a.docx', type: 'application/msword', size: 10 })).toMatch(/^„a\.docx” nu e acceptat/);
    expect(checkNewAttachment([], { name: 'mare.pdf', type: 'application/pdf', size: 11 * MB })).toMatch(/^„mare\.pdf” are 11,0 MB/);
  });

  it('refuză mai mult de 5 fişiere şi peste 20 MB declaraţi', () => {
    expect(checkDeclaredAttachments('u1', Array.from({ length: 6 }, () => att({ size: 1 })))).toMatch(/Cel mult 5/);
    expect(checkDeclaredAttachments('u1', [att({ size: 15 * MB }), att({ size: 6 * MB })])).toMatch(/pe întrebare/);
  });
});

describe('sniffAttachmentType', () => {
  const bytes = (...b: number[]) => Uint8Array.from(b);

  it('recunoaşte PDF, JPEG, PNG şi WebP după primii octeţi', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('%PDF-1.4'))).toBe('application/pdf');
    expect(sniffAttachmentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffAttachmentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffAttachmentType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('întoarce null pentru orice altceva, inclusiv un executabil redenumit .pdf', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('MZ\x90\0'))).toBeNull();
    expect(sniffAttachmentType(new Uint8Array(0))).toBeNull();
  });
});

describe('formatMb', () => {
  it('scrie cu virgulă zecimală', () => {
    expect(formatMb(2.5 * MB)).toBe('2,5 MB');
  });
});
