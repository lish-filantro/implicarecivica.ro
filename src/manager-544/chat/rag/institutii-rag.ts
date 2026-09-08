/**
 * Institution knowledge base for the chat `rag_search` tool.
 *
 * Replaces the former pgvector + OpenAI-embeddings backend. The corpus is the
 * 86 curated JSON files in data/institutii, so a deterministic keyword search
 * over the pre-built index is both cheaper and more predictable than vector
 * similarity. No external API is involved.
 *
 * Server-only (reads the JSON files through lib/institutii). Moved from lib/rag/institutii-rag.ts
 * in refactor phase 5; lib/institutii-search stays in lib because the public search page uses it.
 */

import { getAllInstitutii, getSearchIndex, type Institutie } from '@/lib/institutii'
import { searchEntries } from '@/lib/institutii-search'

export interface RagSearchOptions {
  topK?: number
  /** Locality from the conversation (fills {localitate}-style placeholders) */
  localitate?: string
  /** County from the conversation (fills {judet}-style placeholders) */
  judet?: string
}

export interface RagInstitutionResult {
  slug: string
  nume: string
  tip_institutie: string
  nivel: string
  /** true when this is a generic type instantiated per locality/county (Primărie, Consiliu Județean, ISJ…) */
  este_sablon: boolean
  aplicabilitate: string
  atributii: string[]
  exemple_cereri_544: string[]
  contact_cereri_544: string | null
  email_sediu: string | null
  tipar_email: string | null
  site: string | null
  legislatie_principala: string | null
  /** For templates: explains how the concrete institution is named */
  nota_instantiere: string | null
  scor: number
}

const LOCALITATE_PLACEHOLDERS = /\{(LOCALITATE|localitate|nume_localitate|oras|nume_oraș|municipiu|nume_municipiu|nume_comună|nume|NUME_SCURT|nume_scurtat)\}/g
const JUDET_PLACEHOLDERS = /\{(JUDET|judet|nume_județ)\}/g
/** Qualifiers we cannot infer (e.g. "{tip_localitate}" = comună/oraș/municipiu) — dropped once a locality is known */
const UNKNOWN_QUALIFIERS = /\s*\{(tip_localitate|tip|TIP_SCOALA)\}/g

/** Slugify a Romanian locality/county for use inside email/site patterns */
function slugForPattern(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function fill(text: string | undefined | null, opts: RagSearchOptions, forPattern: boolean): string | null {
  if (!text) return null
  let out = text
  if (opts.localitate) {
    const v = forPattern ? slugForPattern(opts.localitate) : opts.localitate
    out = out.replace(LOCALITATE_PLACEHOLDERS, v)
  }
  if (opts.judet) {
    const v = forPattern ? slugForPattern(opts.judet) : opts.judet
    out = out.replace(JUDET_PLACEHOLDERS, v)
  }
  if (!forPattern && (opts.localitate || opts.judet)) {
    out = out.replace(UNKNOWN_QUALIFIERS, '').replace(/\s{2,}/g, ' ').trim()
  }
  return out
}

function toResult(inst: Institutie, score: number, opts: RagSearchOptions): RagInstitutionResult {
  const tp = inst.template_pattern
  const numeFormat = tp?.nume_format || inst.nume_oficial
  const nume = inst.is_template ? (fill(numeFormat, opts, false) || inst.nume_oficial) : inst.nume_oficial

  const contact = inst.procedura_544?.contact_cereri
  const emailSediu = inst.sediu?.email

  let nota: string | null = null
  if (inst.is_template) {
    nota = `Instituție de tip generic. Numele concret se formează după tiparul "${numeFormat}"` +
      (opts.localitate || opts.judet ? '' : ' — completează cu localitatea/județul din problema utilizatorului.') +
      ' Emailul real trebuie verificat pe site-ul oficial (folosește web_search).'
  }

  return {
    slug: inst.slug,
    nume,
    tip_institutie: inst.tip_institutie,
    nivel: inst.nivel,
    este_sablon: inst.is_template,
    aplicabilitate: inst.aplicabilitate,
    atributii: inst.atributii_principale.slice(0, 8),
    exemple_cereri_544: inst.cazuri_utilizare_544.slice(0, 6),
    contact_cereri_544: fill(contact, opts, true),
    email_sediu: emailSediu ? fill(emailSediu, opts, true) : null,
    tipar_email: tp?.email_format ? fill(tp.email_format, opts, true) : null,
    site: fill(inst.sediu?.site || inst.link_uri_oficiale?.site_principal || tp?.site_format, opts, true),
    legislatie_principala: inst.legislatie_baza?.document_principal || null,
    nota_instantiere: nota,
    scor: Math.round(score * 10) / 10,
  }
}

/**
 * Search the institution knowledge base.
 * Returns the best-matching institutions with the fields Haiku needs to
 * decide jurisdiction and to phrase the follow-up web search for the email.
 */
export function searchInstitutii(query: string, opts: RagSearchOptions = {}): RagInstitutionResult[] {
  const topK = Math.min(Math.max(opts.topK ?? 5, 1), 10)
  const hits = searchEntries(getSearchIndex(), query, topK)
  if (hits.length === 0) return []

  const bySlug = new Map(getAllInstitutii().map(i => [i.slug, i]))
  return hits
    .map(h => {
      const inst = bySlug.get(h.entry.slug)
      return inst ? toResult(inst, h.score, opts) : null
    })
    .filter((r): r is RagInstitutionResult => r !== null)
}

/** Fetch one institution by slug (full detail), for follow-up lookups */
export function getInstitutieDetail(slug: string, opts: RagSearchOptions = {}): RagInstitutionResult | null {
  const inst = getAllInstitutii().find(i => i.slug === slug)
  return inst ? toResult(inst, 0, opts) : null
}
