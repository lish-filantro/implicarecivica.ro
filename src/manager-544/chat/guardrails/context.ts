/**
 * Problem context (CE / UNDE / CÂND + locality) extracted from the assistant's
 * problem summary. Two summary formats are recognised:
 *   1) ✅PROBLEMA_DEFINITĂ: CE:[...] UNDE:[...] DE_CÂND:[...]
 *   2) ✅ CE: [...] ✅ UNDE: [...] ✅ DE_CÂND: [...]   (per-field format Haiku also uses)
 */

export interface HistoryMessage {
  role: string;
  content: string;
}

export interface ProblemContext {
  ce: string | null;
  unde: string | null;
  cand: string | null;
  localitate: string | null;
}

const EMPTY_CONTEXT: ProblemContext = { ce: null, unde: null, cand: null, localitate: null };

export function isAssistantRole(role: string): boolean {
  return role === 'assistant' || role === 'model';
}

/** Lower-case + strip diacritics, so "PROBLEMA_DEFINITĂ" and "problema_definita" compare equal. */
export function normalizeMarkerText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function hasProblemaDefinitaMarker(content: string): boolean {
  return normalizeMarkerText(content).includes('problema_definita') || content.includes('PROBLEMA_DEFINIT');
}

/** Per-field summary: ✅ CE, ✅ UNDE and ✅ (DE_)CÂND all present (bold markdown tolerated). */
export function hasCompleteSummary(content: string): boolean {
  const hasCE = /✅\s*\*{0,2}\s*CE\s*\*{0,2}\s*[:\s]/i.test(content);
  const hasUNDE = /✅\s*\*{0,2}\s*UNDE\s*\*{0,2}\s*[:\s]/i.test(content);
  const hasCAND = /✅\s*\*{0,2}\s*(?:DE_)?C[AÂ]ND\s*\*{0,2}\s*[:\s]/i.test(content);
  return hasCE && hasUNDE && hasCAND;
}

/** Trim and drop the [brackets] the model wraps around field values ("CE:[groapă...]"). */
function unwrap(value: string): string {
  return value.trim().replace(/^\[+\s*/, '').replace(/\s*\]+[.\s]*$/, '').trim();
}

/** Street-type prefixes: a comma segment starting with one is the street line, never the locality. */
const STREET_PREFIX = /^(str(ada)?|bd|b-?dul|bulevardul|calea|aleea|pia[țt]a|[șs]os(eaua)?|drumul|intrarea|splaiul|bl(oc)?|sc(ara)?|ap|et(aj)?)\b/i;
/** "Sector 3" / "Sectorul 1": a Bucharest subdivision, not the locality. */
const SECTOR_SEGMENT = /^sectorul?\b/i;
/** Administrative qualifiers dropped from the locality itself. */
const UNIT_PREFIX = /^(comuna|ora[șs]ul|municipiul|satul)\s+/i;

/**
 * Locality from a full address, comma-separated. The street line (prefix or
 * digits), sectors and empty parts are dropped; of what remains, the
 * second-to-last part is the locality when a county follows ("Pitești, Argeș"),
 * otherwise the only part ("București", "Sector 3, București").
 *   "Str. X nr. 5, București, Sector 3" → "București"
 *   "Bd. Republicii nr. 12, Pitești, Argeș" → "Pitești"
 *   "Comuna Pantelimon, Ilfov" → "Pantelimon";  "Strada X nr 1" → null
 */
export function extractLocalitate(unde: string): string | null {
  const candidates = unde
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/\d/.test(s) && !SECTOR_SEGMENT.test(s) && !STREET_PREFIX.test(s));
  if (candidates.length === 0) return null;
  const locality = candidates.length >= 2 ? candidates[candidates.length - 2] : candidates[0];
  const cleaned = locality.replace(UNIT_PREFIX, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parseSummary(content: string): ProblemContext {
  // Strip markdown bold around field names before extraction
  const clean = content.replace(/\*{1,2}/g, '');
  const result: ProblemContext = { ...EMPTY_CONTEXT };

  const ceMatch = clean.match(/CE[:\s]+(.+?)(?:\s*✅?\s*UNDE|\s*✅?\s*DE_C[AÂ]ND|\n|$)/i);
  if (ceMatch) result.ce = unwrap(ceMatch[1]);

  const undeMatch = clean.match(/UNDE[:\s]+(.+?)(?:\s*✅?\s*DE_C[AÂ]ND|\s*✅?\s*C[AÂ]ND|\n|$)/i);
  if (undeMatch) result.unde = unwrap(undeMatch[1]);

  const candMatch = clean.match(/(?:DE_)?C[AÂ]ND[:\s]+(.+?)(?:\.|Confirm[aă]|\n|$)/i);
  if (candMatch) result.cand = unwrap(candMatch[1]);

  if (result.unde) result.localitate = extractLocalitate(result.unde);
  return result;
}

/** CE/UNDE/CÂND from the first assistant summary in the history (user messages are ignored). */
export function extractProblemContext(history: HistoryMessage[]): ProblemContext {
  for (const msg of history) {
    if (!isAssistantRole(msg.role)) continue;
    if (!hasProblemaDefinitaMarker(msg.content) && !hasCompleteSummary(msg.content)) continue;
    return parseSummary(msg.content);
  }
  return { ...EMPTY_CONTEXT };
}
