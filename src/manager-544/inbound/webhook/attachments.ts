/**
 * Persist parsed MIME attachments to the attachments bucket.
 * Paths: `<ownerPrefix>/<emailId>/<storage key>`. Oversized files are skipped,
 * names are sanitized and de-duplicated.
 *
 * An upload failure THROWS instead of being skipped. Skipping stored the email without the
 * file — often the institution's actual answer — and then the raw MIME was deleted from R2, so
 * the file was gone for good. Throwing happens before the row is inserted: the webhook answers
 * 5xx, the raw email stays in R2 and the reconcile cron retries it (every 6 h, for 7 days, then
 * it is reported as stale and kept for a human). Oversize stays a skip: a retry cannot fix it.
 *
 * The display `name` keeps the sender's spelling (diacritics included); the object key goes
 * through `storageKeyName`, because Supabase Storage rejects non-ASCII keys ("Invalid key") and
 * `%` — a reply carrying `Răspuns.pdf` used to lose its PDF. Both are de-duplicated separately:
 * `Răspuns.pdf` and `Raspuns.pdf` in one email are two names and must be two objects.
 */
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import { storageKeyName } from '@m544/shared/utils/storage-key';
import type { ParsedAttachment } from './mime';

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export interface SavedAttachment {
  name: string;
  type: string;
  size: number;
  path: string;
}

export interface SaveAttachmentsDeps {
  /** First path segment: the user id (RLS folder) or `campaign-<id>`. */
  ownerPrefix: string;
  emailId: string;
  storage: StorageRepo;
}

// Control characters (0x00-0x1f, 0x7f) are removed from file names.
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/** Strip directories and control characters; never return an empty or dot-only name. */
export function safeFilename(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop()!.replace(CONTROL_CHARS, '').trim();
  if (!base || /^\.+$/.test(base)) return 'attachment';
  return base;
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export class AttachmentUploadError extends Error {
  constructor(readonly filename: string, readonly cause: unknown) {
    super(`Attachment upload failed for ${filename}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'AttachmentUploadError';
  }
}

export async function saveAttachments(
  attachments: ParsedAttachment[],
  deps: SaveAttachmentsDeps,
): Promise<SavedAttachment[]> {
  const saved: SavedAttachment[] = [];
  const taken = new Set<string>();
  const takenKeys = new Set<string>();

  for (const att of attachments) {
    const size = att.content.byteLength;
    if (size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[Attachments] ${att.filename} too large (${size} bytes), skipping`);
      continue;
    }
    const name = uniqueName(safeFilename(att.filename), taken);
    const key = uniqueName(storageKeyName(name), takenKeys);
    const path = `${deps.ownerPrefix}/${deps.emailId}/${key}`;
    try {
      await deps.storage.upload(path, att.content, att.mimeType);
      taken.add(name);
      takenKeys.add(key);
      saved.push({ name, type: att.mimeType, size, path });
    } catch (err) {
      throw new AttachmentUploadError(name, err);
    }
  }
  return saved;
}

/** Path of the first PDF attachment (the one the OCR step processes), or null. */
export function pickPdfPath(saved: SavedAttachment[]): string | null {
  return saved.find((a) => a.type === 'application/pdf')?.path ?? null;
}
