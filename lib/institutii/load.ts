/**
 * Loads the curated institution JSON files from data/institutii (server only:
 * uses fs) and caches them for the lifetime of the process.
 */
import fs from 'fs'
import path from 'path'
import type { Institutie, NivelCategorie } from './types'

function toSlug(id: string): string {
  return id.toLowerCase().replace(/_/g, '-').replace(/-template$/, '')
}

function categorizeNivel(nivel: string): NivelCategorie {
  if (nivel.startsWith('National')) return 'National'
  if (nivel.includes('Județean') || nivel.includes('Regional')) return 'Județean'
  return 'Local'
}

/**
 * Scoate placeholderele (`{JUDET}`, `{LOCALITATE}`, ...) din numele unui template.
 *
 * Placeholderul se înlocuieşte cu un SPAŢIU, nu cu nimic: varianta veche consuma şi spaţiile
 * vecine, iar „Comisariatul Județului {JUDET} al Gărzii..." devenea „Comisariatul Județuluial
 * Gărzii...". Spaţiile rămase se colapsează la final.
 */
function stripPlaceholders(name: string): string {
  return name.replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()
}

let cachedInstitutii: Institutie[] | null = null

export function getAllInstitutii(): Institutie[] {
  if (cachedInstitutii) return cachedInstitutii

  const dir = path.join(process.cwd(), 'data', 'institutii')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

  cachedInstitutii = files
    .filter(f => f !== 'raport_verificare_atributii.docx')
    .map(file => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
      const id: string = raw.id
      // Templates are either marked in the id or carry a {PLACEHOLDER} in the official name
      // (e.g. IJSU_JUDETEAN → "Inspectoratul Județean pentru Situații de Urgență {JUDET}")
      const isTemplate = id.includes('TEMPLATE') || /\{[A-Za-z_/ăâîșț]+\}/.test(raw.nume_oficial || '')

      return {
        id,
        slug: toSlug(id),
        tip_institutie: raw.tip_institutie,
        nivel: raw.nivel,
        // Un template al cărui nume era numai placeholdere (`{TIP_SCOALA} {NUME_SCOALA}`) ar
        // rămâne fără etichetă în lista de căutare; cade pe tipul instituţiei.
        nume_oficial: isTemplate
          ? stripPlaceholders(raw.nume_oficial || '') || raw.tip_institutie || id
          : (raw.nume_oficial || raw.nume_scurt || id),
        nume_scurt: isTemplate
          ? stripPlaceholders(raw.nume_scurt || raw.nume_oficial || '') || raw.tip_institutie || id
          : (raw.nume_scurt || raw.nume_oficial || id),
        aplicabilitate: raw.aplicabilitate,
        sediu: raw.sediu,
        link_uri_oficiale: raw.link_uri_oficiale,
        atributii_principale: raw.atributii_principale || [],
        cazuri_utilizare_544: raw.cazuri_utilizare_544 || [],
        legislatie_baza: raw.legislatie_baza,
        procedura_544: raw.procedura_544,
        keywords_cautare: raw.keywords_cautare,
        template_pattern: raw.template_pattern,
        is_template: isTemplate,
        nivel_categorie: categorizeNivel(raw.nivel),
      } satisfies Institutie
    })
    .sort((a, b) => a.nume_scurt.localeCompare(b.nume_scurt, 'ro'))

  return cachedInstitutii
}

export function getInstitutieBySlug(slug: string): Institutie | undefined {
  return getAllInstitutii().find(i => i.slug === slug)
}

export function getInstitutiiByNivel(nivel: NivelCategorie): Institutie[] {
  return getAllInstitutii().filter(i => i.nivel_categorie === nivel)
}
