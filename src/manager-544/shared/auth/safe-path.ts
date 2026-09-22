/**
 * Destinaţia unui redirect de după autentificare se acceptă doar dacă rămâne pe platformă.
 *
 * Destinaţia vine din URL (`?next=` la callback, `?redirectedFrom=` la login), deci o poate scrie
 * oricine. Fără verificare, un link către pagina noastră de login trimitea omul, imediat după ce
 * s-a autentificat, pe un site străin — exact momentul în care are încredere că e încă la noi.
 *
 * Modul pur, fără dependenţe de server: îl folosesc şi callback-ul (server), şi formularul de
 * login (client).
 */

/** Doar căi relative interne: `/x`, niciodată `//host`, `/\host`, `https:` sau `javascript:`. */
export function isSafeRelativePath(next: string | null | undefined): next is string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return false;
  try {
    return new URL(next, 'http://probe.invalid').origin === 'http://probe.invalid';
  } catch {
    return false;
  }
}
