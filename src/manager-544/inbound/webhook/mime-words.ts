/**
 * Decodarea „encoded-words" din headerele de email (RFC 2047): `=?charset?encoding?text?=`.
 *
 * De ce aici şi nu din `postal-mime`. Parserul MIME expune un subiect deja decodat, dar el
 * rulează abia după ce subiectul a fost folosit pentru detectarea campaniilor (`ingest.ts`) şi
 * nu rulează deloc pe calea de reconciliere din R2, care reconstruieşte plicul din
 * customMetadata. Decodarea în plic acoperă uniform toate căile cu o singură funcţie pură.
 *
 * Reguli implementate:
 *  - encoding `Q` (quoted-printable adaptat): `_` înseamnă spaţiu, `=XX` un octet hexazecimal;
 *  - encoding `B`: base64;
 *  - spaţiul alb dintre două encoded-words adiacente se elimină (RFC 2047 §6.2), dar spaţiul
 *    dintre un encoded-word şi text obişnuit se păstrează;
 *  - orice lucru pe care nu îl putem decoda în siguranţă (charset necunoscut, base64 invalid,
 *    terminator lipsă) se întoarce neatins: un subiect urât e mai bun decât o excepţie pe calea
 *    de ingestie, care ar bloca primirea emailului.
 */

/** `=?charset?encoding?text?=` — textul nu poate conţine spaţii sau `?`. */
const ENCODED_WORD = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

/** Charseturi pe care le ştim mapa la un TextDecoder; altfel lăsăm textul neatins. */
function decodeBytes(bytes: Uint8Array, charset: string): string | null {
  const label = charset.toLowerCase().split('*')[0]; // RFC 2231 poate adăuga `*limbă`
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function decodeQ(text: string): Uint8Array {
  const withSpaces = text.replace(/_/g, ' ');
  const bytes: number[] = [];
  for (let i = 0; i < withSpaces.length; i += 1) {
    const ch = withSpaces[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(withSpaces.slice(i + 1, i + 3))) {
      bytes.push(parseInt(withSpaces.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeB(text: string): Uint8Array | null {
  try {
    return Uint8Array.from(Buffer.from(text, 'base64'));
  } catch {
    return null;
  }
}

/**
 * Întoarce `value` cu fiecare encoded-word decodat. Textul fără encoded-words trece neschimbat,
 * deci funcţia e idempotentă şi poate fi aplicată defensiv oriunde.
 */
export function decodeEncodedWords(value: string): string {
  if (!value.includes('=?')) return value;

  // Marcăm spaţiul alb dintre două encoded-words adiacente ca să îl putem elimina după decodare.
  const joined = value.replace(/(\?=)\s+(=\?)/g, '$1\u0000$2');

  const decoded = joined.replace(
    ENCODED_WORD,
    (whole, charset: string, encoding: string, text: string) => {
      const bytes = encoding.toUpperCase() === 'B' ? decodeB(text) : decodeQ(text);
      if (!bytes) return whole;
      return decodeBytes(bytes, charset) ?? whole;
    },
  );

  // Separatorul rămâne doar dacă unul dintre vecini nu a putut fi decodat; atunci era spaţiu real.
  return decoded.replace(/\u0000/g, (_m, offset: number, s: string) =>
    s.slice(0, offset).endsWith('?=') ? ' ' : '',
  );
}
