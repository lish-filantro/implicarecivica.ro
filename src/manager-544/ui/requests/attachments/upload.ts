/**
 * Încărcarea unui fişier ales la o întrebare, direct în bucket-ul `email-attachments`.
 * RLS-ul bucket-ului permite fiecărui utilizator să scrie doar sub `<uid>/…`; calea o construieşte
 * `outgoingPath`, cu un id nou la fiecare fişier, ca acelaşi fişier ataşat de două ori să nu se
 * suprascrie. Spec: docs/plans/2026-09-23-atasamente-design.md §3, §4.3.
 */
import { createBrowserClient } from '@m544/shared/db/browser-client';
import { ATTACHMENTS_BUCKET } from '@m544/shared/db/storage-repo';
import { safeFilename } from '@m544/inbound/webhook/attachments';
import { outgoingPath, type OutgoingAttachment } from '@m544/requests/attachments';

export interface AttachmentUploader {
  userId(): Promise<string>;
  upload(path: string, file: File): Promise<void>;
}

export function browserUploader(): AttachmentUploader {
  const sb = createBrowserClient();
  return {
    async userId() {
      const { data, error } = await sb.auth.getUser();
      if (error || !data.user) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
      return data.user.id;
    },
    async upload(path, file) {
      const { error } = await sb.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
    },
  };
}

export async function uploadAttachment(
  file: File,
  deps: { uploader?: AttachmentUploader; newId?: () => string } = {},
): Promise<OutgoingAttachment> {
  const uploader = deps.uploader ?? browserUploader();
  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  const path = outgoingPath(await uploader.userId(), id, file.name);
  await uploader.upload(path, file);
  return { path, name: safeFilename(file.name), type: file.type, size: file.size };
}
