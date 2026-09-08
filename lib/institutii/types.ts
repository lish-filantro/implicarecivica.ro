/**
 * Types of the curated institution knowledge base (data/institutii/*.json).
 * Pure types: safe to import from client components.
 */

export interface Procedura544 {
  contact_cereri?: string
  telefon_cereri?: string
  departament_responsabil?: string
  email_propuneri?: string
  contestatii?: string
  rapoarte_anuale?: string
}

export interface KeywordsCautare {
  termeni_oficiali?: string[]
  termeni_populari?: string[]
  probleme_cetatean?: string[]
  domenii_semantice?: string[]
  termeni_gresiti?: string[]
  contexte_situationale?: string[]
}

export type NivelCategorie = 'National' | 'Județean' | 'Local'

export interface Institutie {
  id: string
  slug: string
  tip_institutie: string
  nivel: string
  nume_oficial: string
  nume_scurt: string
  aplicabilitate: string
  sediu?: {
    adresa?: string
    telefon?: string
    email?: string
    site?: string
  }
  link_uri_oficiale?: Record<string, string>
  atributii_principale: string[]
  cazuri_utilizare_544: string[]
  legislatie_baza?: {
    document_principal?: string
    [key: string]: unknown
  }
  procedura_544?: Procedura544
  keywords_cautare?: KeywordsCautare
  /** For template institutions: how to build the concrete name/email for a locality/county */
  template_pattern?: {
    nume_format?: string
    email_format?: string
    site_format?: string
    [key: string]: unknown
  }
  is_template: boolean
  nivel_categorie: NivelCategorie
}

/* ── Domain / thematic grouping ── */

export interface Domeniu {
  id: string
  label: string
  icon: string
  description: string
  /** Institution IDs (prefix-matched) belonging to this domain */
  patterns: string[]
}

export interface CazPopular {
  text: string
  institutieSlug: string
  institutieNume: string
  domeniuId: string
}

/* ── Search index ── */

export interface SearchEntry {
  slug: string
  numeScurt: string
  numeOficial: string
  /** Full text, normalized — for exact substring matching */
  haystack: string
  /** Unique words (3+ chars), normalized — for fuzzy word-to-word matching */
  words: string[]
}
