/**
 * Guard against hallucinated registration numbers: a candidate is accepted
 * only when it (or its numeric core) actually appears in the analysed text.
 */

const LAW_NUMBER = /^544\/?2001$/i;
const MIN_LENGTH = 3;
const MIN_DIGITS = 3;

/**
 * Returns the trimmed candidate when it is found in `fullText`, otherwise null.
 * Comparison ignores whitespace and dots in the candidate and whitespace in the text;
 * as a fallback the first run of at least 3 digits is searched on its own.
 */
export function validateRegistrationNumber(candidate: string | null, fullText: string): string | null {
  if (!candidate || candidate.length < MIN_LENGTH) return null;

  // "544/2001" is the law, never a registration number
  if (LAW_NUMBER.test(candidate.trim())) return null;

  const normCandidate = candidate.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  const normText = fullText.toLowerCase().replace(/\s+/g, '');

  if (normText.includes(normCandidate)) return candidate.trim();

  // Fall back to the numeric part (e.g. "1234" from "Nr. 1234/2025")
  const numeric = /\d+/.exec(candidate)?.[0];
  if (numeric && numeric.length >= MIN_DIGITS && normText.includes(numeric)) {
    return candidate.trim();
  }

  return null;
}
