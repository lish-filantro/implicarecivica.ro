/**
 * Ataşamentele unei întrebări dintr-o cerere 544: tipul, limitele şi verificările comune
 * browserului (la alegere) şi serverului (la trimitere). Modul pur, fără I/O — rulează în ambele.
 *
 * Limitele vin din Resend: 40 MB pe email, măsuraţi DUPĂ codarea base64 (+~33%). 20 MB bruţi
 * pe întrebare ajung la ~27 MB, cu loc pentru corpul emailului.
 * Spec: docs/plans/2026-09-23-atasamente-design.md
 */
import { safeFilename } from '@m544/inbound/webhook/attachments';

export interface OutgoingAttachment {
  /** `<uid>/outgoing/<id>/<nume>` — primul segment e folderul RLS al bucket-ului. */
  path: string;
  name: string;
  /** Pe client: MIME-ul declarat de browser. Pe server se înlocuieşte cu tipul citit din octeţi. */
  type: string;
  size: number;
}

export const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];
/** Pentru `<input accept>`: pe iOS, cererea explicită de JPEG face Safari să convertească HEIC. */
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(',');

const MB = 1024 * 1024;
export const MAX_ATTACHMENT_FILE_BYTES = 10 * MB;
export const MAX_ATTACHMENTS_BYTES_PER_QUESTION = 20 * MB;
export const MAX_ATTACHMENTS_PER_QUESTION = 5;

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

export function outgoingPrefix(userId: string): string {
  return `${userId}/outgoing/`;
}

/** `safeFilename` taie directoarele, deci un nume ca `../../x.pdf` nu poate ieşi din folder. */
export function outgoingPath(userId: string, id: string, filename: string): string {
  return `${outgoingPrefix(userId)}${id}/${safeFilename(filename)}`;
}

function isAllowedType(type: string): type is AllowedAttachmentType {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

const sumSizes = (list: readonly { size: number }[]) => list.reduce((total, a) => total + a.size, 0);

// Aceleaşi cuvinte în browser (la alegere) şi pe server (după descărcare), ca omul să vadă
// cifrele oriunde s-ar opri fişierul.
const tooMany = () => `Cel mult ${MAX_ATTACHMENTS_PER_QUESTION} fișiere pe întrebare.`;
export const fileTooBigMessage = (name: string, size: number) =>
  `„${name}” are ${formatMb(size)}; maximum ${formatMb(MAX_ATTACHMENT_FILE_BYTES)} pe fișier.`;
export const totalTooBigMessage = (total: number) =>
  `Împreună, fișierele au ${formatMb(total)}; maximum ${formatMb(MAX_ATTACHMENTS_BYTES_PER_QUESTION)} pe întrebare.`;

/** Browser: null când `file` se poate adăuga lângă `existing`; altfel motivul, pentru om. */
export function checkNewAttachment(
  existing: readonly { size: number }[],
  file: { name: string; type: string; size: number },
): string | null {
  if (!isAllowedType(file.type)) return `„${file.name}” nu e acceptat: doar imagini JPEG, PNG, WebP sau PDF.`;
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) return fileTooBigMessage(file.name, file.size);
  if (existing.length >= MAX_ATTACHMENTS_PER_QUESTION) return tooMany();
  const total = sumSizes(existing) + file.size;
  if (total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) return totalTooBigMessage(total);
  return null;
}

/**
 * Caractere care nu apar niciodată într-o cale construită de `outgoingPath` (id-ul e un UUID, iar
 * numele trece prin `safeFilename`), dar pe care un strat de mai jos le-ar putea decoda sau
 * interpreta: `%` (codare URL), `\` (separator pe alte sisteme), `?` şi `#` (query/fragment).
 * Apărare în adâncime peste RLS-ul bucket-ului.
 */
const SUSPICIOUS_PATH_CHARS = /[%\\?#]/;

/**
 * Server, înainte de orice descărcare: ce a declarat clientul trebuie să stea în folderul
 * utilizatorului şi în limite. Mărimea şi tipul REALE se verifică după descărcare.
 */
export function checkDeclaredAttachments(userId: string, list: readonly OutgoingAttachment[]): string | null {
  if (list.length > MAX_ATTACHMENTS_PER_QUESTION) return tooMany();
  for (const a of list) {
    const segments = a.path.split('/');
    if (
      !a.path.startsWith(outgoingPrefix(userId)) ||
      SUSPICIOUS_PATH_CHARS.test(a.path) ||
      segments.some((s) => s === '' || s === '.' || s === '..')
    ) {
      return `Fișier nepermis: „${a.name}”.`;
    }
  }
  const total = sumSizes(list);
  if (total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) return totalTooBigMessage(total);
  return null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/** Tipul real, după primii octeţi; null pentru orice altceva, oricum s-ar numi fişierul. */
export function sniffAttachmentType(bytes: Uint8Array): AllowedAttachmentType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

const EXTENSIONS: Record<AllowedAttachmentType, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
export const MAX_ATTACHMENT_NAME_LENGTH = 150;

/**
 * Server: numele cu care pleacă fişierul la instituţie şi rămâne pe rândul emailului. Numele vine
 * din cerere, deci poate fi orice: se curăţă (fără directoare şi caractere de control), primeşte
 * extensia tipului CITIT din octeţi — un PDF/HTML poliglot declarat „factura.html” pleacă drept
 * „factura.html.pdf” — şi se taie la 150 de caractere, păstrând extensia.
 */
export function outgoingFilename(declared: string, type: AllowedAttachmentType): string {
  const clean = safeFilename(declared);
  const allowed = EXTENSIONS[type];
  const current = allowed.find((ext) => clean.toLowerCase().endsWith(ext));
  const ext = current ? clean.slice(clean.length - current.length) : allowed[0];
  const stem = current ? clean.slice(0, clean.length - current.length) : clean;
  // Pe puncte de cod, nu pe unităţi UTF-16, ca tăietura să nu rupă un caracter în două.
  const kept = Array.from(stem).slice(0, MAX_ATTACHMENT_NAME_LENGTH - ext.length).join('');
  return `${kept}${ext}`;
}
