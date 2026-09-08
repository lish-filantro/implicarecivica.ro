/**
 * Canonical key of an institution name, used as `institutii_locale.nume_normalizat`
 * so that "Primăria Municipiului Pitești", "PRIMARIA MUNICIPIULUI PITESTI." and
 * "primaria  municipiului pitesti" all land on the same row.
 *
 * Steps: NFD + drop combining marks (diacritics, both ș/ț and ş/ţ forms),
 * lower-case, punctuation → space (hyphens and digits kept), collapse whitespace, trim.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
/** Anything that is not a letter, digit, whitespace or hyphen. */
const PUNCTUATION = /[^\p{L}\p{N}\s-]/gu;

export function normalizeInstitutionName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
