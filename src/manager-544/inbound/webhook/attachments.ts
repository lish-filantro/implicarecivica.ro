/**
 * Persist parsed MIME attachments to the attachments bucket.
 * Paths: `<ownerPrefix>/<emailId>/<safe filename>`. Oversized files are skipped,
 * upload failures are logged and skipped, names are sanitized and de-duplicated.
 */
import type { StorageRepo } from '@m544/shared/db/storage-repo';
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

export async function saveAttachments(
  attachments: ParsedAttachment[],
  deps: SaveAttachmentsDeps,
): Promise<SavedAttachment[]> {
  const saved: SavedAttachment[] = [];
  const taken = new Set<string>();

  for (const att of attachments) {
    const size = att.content.byteLength;
    if (size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[Attachments] ${att.filename} too large (${size} bytes), skipping`);
      continue;
    }
    const name = uniqueName(safeFilename(att.filename), taken);
    const path = `${deps.ownerPrefix}/${deps.emailId}/${name}`;
    try {
      await deps.storage.upload(path, att.content, att.mimeType);
      taken.add(name);
      saved.push({ name, type: att.mimeType, size, path });
    } catch (err) {
      console.error(`[Attachments] Upload failed for ${name}:`, err instanceof Error ? err.message : err);
    }
  }
  return saved;
}

/** Path of the first PDF attachment (the one the OCR step processes), or null. */
export function pickPdfPath(saved: SavedAttachment[]): string | null {
  return saved.find((a) => a.type === 'application/pdf')?.path ?? null;
}
