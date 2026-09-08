/**
 * inbound/webhook/attachments — persisting parsed attachments to storage.
 */
import { describe, it, expect, vi } from 'vitest';
import { saveAttachments, pickPdfPath, safeFilename, MAX_ATTACHMENT_BYTES } from '@m544/inbound/webhook/attachments';
import { FakeStorageRepo } from '../_fakes/fake-repos';

const bytes = (n: number) => new Uint8Array(n).fill(7);

describe('safeFilename', () => {
  it('keeps ordinary names', () => {
    expect(safeFilename('Raspuns 544.pdf')).toBe('Raspuns 544.pdf');
  });
  it('strips directory components and control characters', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\x\\doc.pdf')).toBe('doc.pdf');
    expect(safeFilename('a\u0000b.pdf')).toBe('ab.pdf');
  });
  it('falls back to "attachment" for empty or dot-only names', () => {
    expect(safeFilename('')).toBe('attachment');
    expect(safeFilename('..')).toBe('attachment');
    expect(safeFilename(undefined)).toBe('attachment');
  });
});

describe('saveAttachments', () => {
  it('uploads each attachment under <owner>/<emailId>/<name> and returns metadata', async () => {
    const storage = new FakeStorageRepo();
    const saved = await saveAttachments(
      [
        { filename: 'confirmare.pdf', mimeType: 'application/pdf', content: bytes(10) },
        { filename: 'sigla.png', mimeType: 'image/png', content: bytes(3) },
      ],
      { ownerPrefix: 'user-1', emailId: 'email-1', storage },
    );
    expect(saved).toEqual([
      { name: 'confirmare.pdf', type: 'application/pdf', size: 10, path: 'user-1/email-1/confirmare.pdf' },
      { name: 'sigla.png', type: 'image/png', size: 3, path: 'user-1/email-1/sigla.png' },
    ]);
    expect(storage.files.get('user-1/email-1/confirmare.pdf')?.contentType).toBe('application/pdf');
  });

  it('skips attachments above the size limit', async () => {
    const storage = new FakeStorageRepo();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const big = { filename: 'big.bin', mimeType: 'application/octet-stream', content: new Uint8Array(MAX_ATTACHMENT_BYTES + 1) };
    const saved = await saveAttachments([big], { ownerPrefix: 'u', emailId: 'e', storage });
    expect(saved).toEqual([]);
    expect(storage.files.size).toBe(0);
    warn.mockRestore();
  });

  it('continues after an upload failure', async () => {
    const storage = new FakeStorageRepo();
    storage.upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async (p: string, b: Uint8Array, t: string) => {
        storage.files.set(p, { bytes: b, contentType: t });
      });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saved = await saveAttachments(
      [
        { filename: 'a.pdf', mimeType: 'application/pdf', content: bytes(1) },
        { filename: 'b.pdf', mimeType: 'application/pdf', content: bytes(1) },
      ],
      { ownerPrefix: 'u', emailId: 'e', storage },
    );
    expect(saved.map((s) => s.name)).toEqual(['b.pdf']);
    error.mockRestore();
  });

  it('sanitizes file names and de-duplicates collisions', async () => {
    const storage = new FakeStorageRepo();
    const saved = await saveAttachments(
      [
        { filename: '../x.pdf', mimeType: 'application/pdf', content: bytes(1) },
        { filename: 'x.pdf', mimeType: 'application/pdf', content: bytes(1) },
      ],
      { ownerPrefix: 'u', emailId: 'e', storage },
    );
    expect(saved.map((s) => s.path)).toEqual(['u/e/x.pdf', 'u/e/x (2).pdf']);
  });
});

describe('pickPdfPath', () => {
  it('returns the first PDF path or null', () => {
    expect(
      pickPdfPath([
        { name: 'a.png', type: 'image/png', size: 1, path: 'p/a.png' },
        { name: 'b.pdf', type: 'application/pdf', size: 1, path: 'p/b.pdf' },
      ]),
    ).toBe('p/b.pdf');
    expect(pickPdfPath([])).toBeNull();
  });
});
