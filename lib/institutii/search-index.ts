/**
 * Pre-built keyword search index over all institutions (server only, cached).
 * The matching itself lives in lib/institutii-search.ts (pure, client-safe).
 */
import type { SearchEntry } from './types'
import { getAllInstitutii } from './load'

/** Normalize Romanian diacritics and lowercase for search matching */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

let cachedIndex: SearchEntry[] | null = null

export function getSearchIndex(): SearchEntry[] {
  if (cachedIndex) return cachedIndex

  cachedIndex = getAllInstitutii().map(inst => {
    const parts: string[] = [
      inst.nume_oficial,
      inst.nume_scurt,
      inst.tip_institutie,
      ...inst.cazuri_utilizare_544,
      ...inst.atributii_principale,
    ]

    const kw = inst.keywords_cautare
    if (kw) {
      if (kw.termeni_oficiali) parts.push(...kw.termeni_oficiali)
      if (kw.termeni_populari) parts.push(...kw.termeni_populari)
      if (kw.probleme_cetatean) parts.push(...kw.probleme_cetatean)
      if (kw.domenii_semantice) parts.push(...kw.domenii_semantice)
      if (kw.termeni_gresiti) parts.push(...kw.termeni_gresiti)
      if (kw.contexte_situationale) parts.push(...kw.contexte_situationale)
    }

    const fullText = normalize(parts.join(' | '))
    const uniqueWords = [...new Set(
      fullText.split(/[^a-z]+/).filter(w => w.length >= 3)
    )]

    return {
      slug: inst.slug,
      numeScurt: inst.nume_scurt,
      numeOficial: inst.nume_oficial,
      haystack: fullText,
      words: uniqueWords,
    }
  })

  return cachedIndex
}
