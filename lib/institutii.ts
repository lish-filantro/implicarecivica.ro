import fs from 'fs'
import path from 'path'

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
  is_template: boolean
  nivel_categorie: 'National' | 'Județean' | 'Local'
}

function toSlug(id: string): string {
  return id.toLowerCase().replace(/_/g, '-').replace(/-template$/, '')
}

function categorizeNivel(nivel: string): 'National' | 'Județean' | 'Local' {
  if (nivel.startsWith('National')) return 'National'
  if (nivel.includes('Județean') || nivel.includes('Regional')) return 'Județean'
  return 'Local'
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
      const isTemplate = id.includes('TEMPLATE')

      return {
        id,
        slug: toSlug(id),
        tip_institutie: raw.tip_institutie,
        nivel: raw.nivel,
        nume_oficial: isTemplate
          ? (raw.nume_oficial || '').replace(/\s*\{.*?\}\s*/g, '').trim()
          : (raw.nume_oficial || raw.nume_scurt || id),
        nume_scurt: isTemplate
          ? (raw.nume_scurt || raw.nume_oficial || '').replace(/\s*\{.*?\}\s*/g, '').trim()
          : (raw.nume_scurt || raw.nume_oficial || id),
        aplicabilitate: raw.aplicabilitate,
        sediu: raw.sediu,
        link_uri_oficiale: raw.link_uri_oficiale,
        atributii_principale: raw.atributii_principale || [],
        cazuri_utilizare_544: raw.cazuri_utilizare_544 || [],
        legislatie_baza: raw.legislatie_baza,
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

export function getInstitutiiByNivel(nivel: 'National' | 'Județean' | 'Local'): Institutie[] {
  return getAllInstitutii().filter(i => i.nivel_categorie === nivel)
}
