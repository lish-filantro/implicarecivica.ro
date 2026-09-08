/**
 * inbound/webhook/mime — raw MIME → body + attachments (postal-mime).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseMime } from '@m544/inbound/webhook/mime';

const fixture = (name: string) => fs.readFileSync(path.resolve(__dirname, '../../../fixtures/inbound', name));

describe('parseMime', () => {
  it('exposes the header From (lower-cased address + display name)', async () => {
    const parsed = await parseMime(fixture('reply-with-pdf.eml'));
    expect(parsed.from).toEqual({ address: 'registratura@primaria-test.ro', name: 'Registratura Primaria' });
    const plain = await parseMime(fixture('plain-text.eml'));
    expect(plain.from).toEqual({ address: 'cineva@gmail.com', name: null });
  });

  it('from is null when the header is missing', async () => {
    const parsed = await parseMime(new TextEncoder().encode('Subject: x\r\n\r\nbody'));
    expect(parsed.from).toBeNull();
  });

  it('prefers the HTML body and exposes text too', async () => {
    const parsed = await parseMime(fixture('reply-with-pdf.eml'));
    expect(parsed.html).toContain('<b>inregistrata</b>');
    expect(parsed.text).toContain('nr. 12345/2026');
    expect(parsed.body).toBe(parsed.html);
  });

  it('extracts attachments with filename, mime type and bytes', async () => {
    const parsed = await parseMime(fixture('reply-with-pdf.eml'));
    expect(parsed.attachments.map((a) => a.filename)).toEqual(['confirmare.pdf', 'sigla.png']);
    const pdf = parsed.attachments[0];
    expect(pdf.mimeType).toBe('application/pdf');
    expect(Buffer.from(pdf.content).subarray(0, 5).toString()).toBe('%PDF-');
    expect(parsed.attachments[1].mimeType).toBe('image/png');
  });

  it('falls back to text body when there is no HTML, with no attachments', async () => {
    const parsed = await parseMime(fixture('plain-text.eml'));
    expect(parsed.html).toBe('');
    expect(parsed.text.trim()).toBe('salut, ce faci');
    expect(parsed.body.trim()).toBe('salut, ce faci');
    expect(parsed.attachments).toEqual([]);
  });

  it('accepts ArrayBuffer input', async () => {
    const buf = fixture('plain-text.eml');
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const parsed = await parseMime(ab);
    expect(parsed.text).toContain('salut');
  });

  it('defaults missing attachment metadata', async () => {
    const raw = [
      'From: a@b.ro',
      'To: c@d.ro',
      'Subject: x',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="B"',
      '',
      '--B',
      'Content-Type: text/plain',
      '',
      'body',
      '--B',
      'Content-Disposition: attachment',
      'Content-Transfer-Encoding: base64',
      '',
      'AAEC',
      '--B--',
      '',
    ].join('\r\n');
    const parsed = await parseMime(Buffer.from(raw));
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].filename).toBe('attachment');
    expect(parsed.attachments[0].mimeType).toMatch(/octet-stream|text\/plain/);
    expect(Array.from(parsed.attachments[0].content)).toEqual([0, 1, 2]);
  });
});
