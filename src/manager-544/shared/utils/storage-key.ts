/**
 * Numele unui obiect din Supabase Storage, derivat din numele (afişat) al unui fişier.
 *
 * De ce: bucket-ul `email-attachments` respinge cheile cu diacritice („Invalid key” pentru
 * `Răspuns 544.pdf`) şi cu `%` („Bad Request” pentru `50%.pdf`) — sondat pe 2026-09-23. Un
 * răspuns de la instituţie cu `Răspuns.pdf` pierdea astfel PDF-ul, iar un fişier cu diacritice nu
 * se putea ataşa la o cerere. Cheia e deci ASCII, dintr-un set mic de caractere; `?` şi `#` se
 * scot şi ele, deşi storage-ul le acceptă, ca `checkDeclaredAttachments` să nu refuze la trimitere
 * o cale acceptată la încărcare.
 *
 * Numele AFIŞAT (rândul din DB, `filename` la Resend) nu trece pe aici — îşi păstrează diacriticele.
 * Funcţie pură şi idempotentă.
 */

const ROMANIAN: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't',
  Ă: 'A', Â: 'A', Î: 'I', Ș: 'S', Ş: 'S', Ț: 'T', Ţ: 'T',
};

export const MAX_STORAGE_KEY_NAME_LENGTH = 150;
const FALLBACK = 'attachment';

// Extensia se ia înainte de curăţare, ca `😀.pdf` să rămână `….pdf`, nu să-şi piardă punctul.
const EXTENSION = /\.[A-Za-z0-9]{1,16}$/;
const DISALLOWED = /[^A-Za-z0-9._() -]/g;
const EDGES = /^[ ._]+|[ ._]+$/g;

function toAscii(name: string): string {
  return name
    .replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (c) => ROMANIAN[c])
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

const clean = (s: string) => s.replace(DISALLOWED, '_').replace(/_+/g, '_').replace(EDGES, '');

/** A Supabase-Storage-safe object-key segment for a (display) file name. */
export function storageKeyName(name: string): string {
  const ascii = toAscii(name);
  const ext = EXTENSION.exec(ascii)?.[0] ?? '';
  const stem = clean(ascii.slice(0, ascii.length - ext.length)) || FALLBACK;
  // Totul e ASCII aici, deci tăietura pe unităţi UTF-16 nu poate rupe un caracter.
  const kept = stem.slice(0, MAX_STORAGE_KEY_NAME_LENGTH - ext.length).replace(EDGES, '') || FALLBACK;
  return `${kept}${ext}`;
}
