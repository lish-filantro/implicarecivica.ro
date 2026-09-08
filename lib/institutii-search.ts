/**
 * Keyword search over the institution index.
 *
 * Pure functions, no fs / no Node APIs — safe to import from both
 * client components (app/institutii/cautare.tsx) and server code
 * (the chat `rag_search` tool in lib/rag/institutii-rag.ts).
 */

import type { SearchEntry } from '@/lib/institutii'

/** Strip Romanian diacritics (both comma-below and cedilla forms) and lowercase */
export function normalizeRo(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

/**
 * Edit distance between two short strings (Levenshtein).
 * Bails out early if distance exceeds maxDist.
 */
export function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length
  const n = b.length
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    row[0] = i
    let rowMin = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = row[j]
      row[j] = val
      if (val < rowMin) rowMin = val
    }
    if (rowMin > maxDist) return maxDist + 1
  }
  return row[n]
}

/** Max allowed edit distance based on word length */
function maxTypos(len: number): number {
  if (len <= 3) return 0
  if (len <= 4) return 1
  return 2
}

/** Very common Romanian words that carry no signal for institution matching */
const STOP_WORDS = new Set([
  'si', 'sau', 'din', 'de', 'la', 'in', 'pe', 'cu', 'un', 'una', 'unei', 'unui',
  'care', 'cine', 'este', 'sunt', 'pentru', 'despre', 'catre', 'nu', 'mai', 'ce',
  'vreau', 'doresc', 'solicit', 'informatii', 'informatie', 'date', 'raspuns',
  'institutie', 'institutia', 'responsabil', 'responsabila', 'problema', 'strada',
  'nr', 'numarul', 'judetul', 'localitatea', 'orasul', 'comuna', 'municipiul',
  // Generic institutional words: present in most names/haystacks, carry no routing signal
  'public', 'publica', 'publice', 'publici', 'national', 'nationala', 'nationale',
  'judetean', 'judeteana', 'judetene', 'local', 'locala', 'locale', 'general', 'generala',
  'agentia', 'agentie', 'directia', 'directie', 'serviciul', 'serviciu', 'oficiul', 'oficiu',
  'inspectoratul', 'inspectorat', 'ministerul', 'minister', 'autoritatea', 'autoritate',
  'romania', 'roman', 'romana', 'romane', 'romanesc', 'stat', 'statului', 'guvern', 'guvernul',
])

/**
 * Score a query word against an entry.
 * Returns 0 (no match) or a positive score.
 */
export function scoreWord(qWord: string, entry: SearchEntry, normName: string): number {
  // Short words (<= 4 chars) must match a whole indexed word, otherwise "apa"
  // would match "aparare" and "bloc" would match "blocaj".
  if (qWord.length <= 4) {
    if (!entry.words.includes(qWord)) return 0
    if (normName.split(/[^a-z]+/).includes(qWord)) return 7
    return 3 + Math.min(countOccurrences(entry.haystack, qWord) - 1, 2)
  }

  // 1. Substring in full haystack — best signal. Repeated occurrences
  //    (the term shows up in several fields) add a small bonus, capped.
  if (entry.haystack.includes(qWord)) {
    if (normName.includes(qWord)) return 7
    return 3 + Math.min(countOccurrences(entry.haystack, qWord) - 1, 2)
  }

  // 2. Fuzzy: find the closest word in the entry's word list
  const allowed = maxTypos(qWord.length)
  if (allowed === 0) return 0

  let bestDist = allowed + 1
  for (const w of entry.words) {
    if (Math.abs(w.length - qWord.length) > allowed) continue
    const d = editDistance(qWord, w, allowed)
    if (d < bestDist) bestDist = d
    if (d <= 1) break
  }

  if (bestDist <= allowed) {
    const fuzzyScore = 2 - bestDist * 0.5
    const nameWords = normName.split(/[^a-z]+/).filter(w => w.length >= 3)
    for (const nw of nameWords) {
      if (Math.abs(nw.length - qWord.length) <= allowed) {
        if (editDistance(qWord, nw, allowed) <= allowed) {
          return fuzzyScore + 3
        }
      }
    }
    return fuzzyScore
  }

  return 0
}

/** Count non-overlapping occurrences of `needle` in `haystack` (at least 1 expected) */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let pos = haystack.indexOf(needle)
  while (pos !== -1 && count < 10) {
    count++
    pos = haystack.indexOf(needle, pos + needle.length)
  }
  return Math.max(count, 1)
}

export interface ScoredEntry {
  entry: SearchEntry
  score: number
}

/**
 * Tokenize a free-text query into normalized search words.
 * Drops stop words so that a full sentence ("vreau informații despre groapa
 * din strada X") is reduced to its meaningful terms.
 */
export function tokenizeQuery(query: string): string[] {
  const words = normalizeRo(query)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2)
  const meaningful = words.filter(w => !STOP_WORDS.has(w))
  // If everything was a stop word, fall back to the raw words
  return meaningful.length > 0 ? meaningful : words
}

/**
 * Rank the index entries against a query. Returns only entries with a
 * positive score, best first, capped at `limit`.
 */
export function searchEntries(index: SearchEntry[], query: string, limit = 8): ScoredEntry[] {
  if (query.trim().length < 2) return []
  const qWords = tokenizeQuery(query)
  if (qWords.length === 0) return []

  const scored: ScoredEntry[] = index.map(entry => {
    const normName = normalizeRo(entry.numeScurt + ' ' + entry.numeOficial)
    let total = 0
    for (const qw of qWords) {
      total += scoreWord(qw, entry, normName)
    }
    return { entry, score: total }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
