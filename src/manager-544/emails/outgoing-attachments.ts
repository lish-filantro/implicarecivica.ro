/**
 * Ataşamentele unei cereri, descărcate şi verificate înainte de trimitere.
 *
 * `storage` TREBUIE să fie construit pe clientul de sesiune al utilizatorului: RLS-ul bucket-ului
 * permite doar căile sub `<uid>/`, deci o cale ghicită sau modificată în cerere eşuează la
 * storage, nu la o verificare pe care am putea-o uita. Spec: docs/plans/2026-09-23-atasamente-design.md §4.4.
 */
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import {
  fileTooBigMessage,
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENTS_BYTES_PER_QUESTION,
  outgoingFilename,
  sniffAttachmentType,
  totalTooBigMessage,
  type AllowedAttachmentType,
  type OutgoingAttachment,
} from '@m544/requests/attachments';

export interface LoadedAttachment {
  filename: string;
  content: Buffer;
  contentType: AllowedAttachmentType;
  /** Ce se salvează pe rândul emailului trimis: tipul şi mărimea reale, plus calea. */
  meta: OutgoingAttachment;
}

export type LoadedAttachments = { ok: true; files: LoadedAttachment[] } | { ok: false; error: string };

export async function loadAttachments(
  list: readonly OutgoingAttachment[],
  storage: Pick<StorageRepo, 'download'>,
): Promise<LoadedAttachments> {
  const files: LoadedAttachment[] = [];
  let total = 0;
  for (const a of list) {
    const bytes = await storage.download(a.path);
    if (!bytes) return { ok: false, error: `Fișierul „${a.name}” nu mai e disponibil. Atașează-l din nou.` };

    total += bytes.byteLength;
    if (bytes.byteLength > MAX_ATTACHMENT_FILE_BYTES) return { ok: false, error: fileTooBigMessage(a.name, bytes.byteLength) };
    if (total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) return { ok: false, error: totalTooBigMessage(total) };
    const contentType = sniffAttachmentType(bytes);
    if (!contentType) return { ok: false, error: `„${a.name}” nu e o imagine JPEG, PNG, WebP sau un PDF.` };

    // Acelaşi nume la instituţie şi pe rândul emailului — curăţat pe server, nu cel declarat.
    const name = outgoingFilename(a.name, contentType);
    files.push({
      filename: name,
      content: Buffer.from(bytes),
      contentType,
      meta: { path: a.path, name, type: contentType, size: bytes.byteLength },
    });
  }
  return { ok: true, files };
}
