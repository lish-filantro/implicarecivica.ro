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

/**
 * Locality from a full address: "..., Comuna Pantelimon, Ilfov" → "Pantelimon",
 * "..., Pitești, Argeș" → "Pitești", "..., București, Sector 3" → "București".
 */
export function extractLocalitate(unde: string): string | null {
  const match = unde.match(
    /,\s*(?:Comuna\s+|Orașul\s+|Municipiul\s+)?([A-ZȘȚĂÎÂa-zșțăîâ\s-]+),\s*(?:județul?\s+)?([A-ZȘȚĂÎÂa-zșțăîâ\s-]+)$/i,
  );
  return match ? match[1].trim() : null;
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
