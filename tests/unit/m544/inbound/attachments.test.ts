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

  // Un atașament sărit ar fi dispărut definitiv: emailul brut se şterge din R2 după inserare.
  it('throws on an upload failure so the raw email stays in R2 for a retry', async () => {
    const storage = new FakeStorageRepo();
    storage.upload = vi.fn().mockRejectedValueOnce(new Error('boom'));
    await expect(
      saveAttachments(
        [
          { filename: 'Răspuns.pdf', mimeType: 'application/pdf', content: bytes(1) },
          { filename: 'b.pdf', mimeType: 'application/pdf', content: bytes(1) },
        ],
        { ownerPrefix: 'u', emailId: 'e', storage },
      ),
    ).rejects.toMatchObject({ name: 'AttachmentUploadError', filename: 'Răspuns.pdf' });
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

  // Supabase Storage respinge cheile cu diacritice („Invalid key”): calea e ASCII, numele afişat nu.
  it('a diacritic name gets an ASCII path and keeps its display name', async () => {
    const storage = new FakeStorageRepo();
    const saved = await saveAttachments(
      [{ filename: 'Răspuns 544 ştampilă.pdf', mimeType: 'application/pdf', content: bytes(2) }],
      { ownerPrefix: 'u', emailId: 'e', storage },
    );
    expect(saved).toEqual([
      { name: 'Răspuns 544 ştampilă.pdf', type: 'application/pdf', size: 2, path: 'u/e/Raspuns 544 stampila.pdf' },
    ]);
    expect([...storage.files.keys()]).toEqual(['u/e/Raspuns 544 stampila.pdf']);
  });

  it('two display names that map to the same key get distinct paths and keep their names', async () => {
    const storage = new FakeStorageRepo();
    const saved = await saveAttachments(
      [
        { filename: 'Răspuns.pdf', mimeType: 'application/pdf', content: bytes(1) },
        { filename: 'Raspuns.pdf', mimeType: 'application/pdf', content: bytes(2) },
      ],
      { ownerPrefix: 'u', emailId: 'e', storage },
    );
    expect(saved.map((s) => s.name)).toEqual(['Răspuns.pdf', 'Raspuns.pdf']);
    expect(saved.map((s) => s.path)).toEqual(['u/e/Raspuns.pdf', 'u/e/Raspuns (2).pdf']);
    expect(storage.files.size).toBe(2);
  });

  it('removes % from the key (storage answers "Bad Request")', async () => {
    const storage = new FakeStorageRepo();
    const saved = await saveAttachments(
      [{ filename: '50%.pdf', mimeType: 'application/pdf', content: bytes(1) }],
      { ownerPrefix: 'u', emailId: 'e', storage },
    );
    expect(saved[0]).toMatchObject({ name: '50%.pdf', path: 'u/e/50.pdf' });
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
