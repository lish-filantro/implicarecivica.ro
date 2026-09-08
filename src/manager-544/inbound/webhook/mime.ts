/**
 * Raw MIME → body + attachments, via postal-mime.
 */
import PostalMime from 'postal-mime';

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  content: Uint8Array;
}

export interface MimeAddress {
  address: string;
  name: string | null;
}

export interface ParsedMime {
  /** The RFC 5322 `From` header (what the reader sees); null when missing/unparseable. */
  from: MimeAddress | null;
  /** HTML when present, else plain text, else ''. This is what gets stored as the email body. */
  body: string;
  html: string;
  text: string;
  attachments: ParsedAttachment[];
}

export const DEFAULT_ATTACHMENT_NAME = 'attachment';
export const DEFAULT_MIME_TYPE = 'application/octet-stream';

function toUint8Array(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof content === 'string') return new TextEncoder().encode(content);
  return new Uint8Array(0);
}

export async function parseMime(raw: ArrayBuffer | Uint8Array): Promise<ParsedMime> {
  const parsed = await new PostalMime().parse(raw);
  const html = parsed.html ?? '';
  const text = parsed.text ?? '';
  const attachments: ParsedAttachment[] = (parsed.attachments ?? []).map((att) => ({
    filename: att.filename || DEFAULT_ATTACHMENT_NAME,
    mimeType: att.mimeType || DEFAULT_MIME_TYPE,
    content: toUint8Array(att.content),
  }));
  return { from: headerFrom(parsed.from), body: html || text || '', html, text, attachments };
}

function headerFrom(from: { address?: string; name?: string } | undefined): MimeAddress | null {
  const address = from?.address?.trim().toLowerCase();
  if (!address) return null;
  return { address, name: from?.name?.trim() || null };
}
