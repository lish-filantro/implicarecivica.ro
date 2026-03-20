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

/* ── Domain / thematic grouping ── */

export interface Domeniu {
  id: string
  label: string
  icon: string
  description: string
  /** Institution IDs (prefix-matched) belonging to this domain */
  patterns: string[]
}

export const DOMENII: Domeniu[] = [
  {
    id: 'finante',
    label: 'Finanțe & Taxe',
    icon: '💰',
    description: 'Bugete, impozite, cheltuieli publice, achiziții',
    patterns: ['ANAF', 'MFP', 'MINISTERUL_FINANTELOR', 'CURTEA_DE_CONTURI', 'AJFP', 'DJFP', 'DGITL', 'BNR', 'ASF'],
  },
  {
    id: 'sanatate',
    label: 'Sănătate',
    icon: '🏥',
    description: 'Spitale, medici, programe de sănătate, asigurări',
    patterns: ['MINISTERUL_SANATATII', 'MS', 'CJAS', 'CNAS', 'DSP', 'ANMCS', 'ANMDMR', 'SPITAL'],
  },
  {
    id: 'educatie',
    label: 'Educație',
    icon: '📚',
    description: 'Școli, universități, inspectorate, evaluare',
    patterns: ['MEC', 'MINISTERUL_EDUCATIEI', 'ISJ', 'ARACIS', 'SCOALA', 'BIBLIOTECA'],
  },
  {
    id: 'justitie',
    label: 'Justiție & Ordine',
    icon: '⚖️',
    description: 'Instanțe, parchete, poliție, penitenciare',
    patterns: ['MJ', 'MINISTERUL_JUSTITIEI', 'CSM', 'TRIBUNAL', 'JUDECATORI', 'CURTEA_DE_APEL', 'PARCHET', 'IPJ', 'ANP'],
  },
  {
    id: 'munca',
    label: 'Muncă & Social',
    icon: '👥',
    description: 'Locuri de muncă, pensii, asistență socială, handicap',
    patterns: ['MMFTSS', 'MINISTERUL_MUNCII', 'MINISTER_MUNCII', 'AJOFM', 'ANOFM', 'AJPIS', 'ANPIS', 'CJP', 'DGASPC', 'COMISIA_EVALUARE_HANDICAP', 'COMISIA_HANDICAP', 'ITM'],
  },
  {
    id: 'mediu',
    label: 'Mediu & Energie',
    icon: '🌿',
    description: 'Protecția mediului, reglementare energie, ape',
    patterns: ['MMAP', 'MINISTERUL_MEDIULUI', 'APM', 'ANPM', 'GNM', 'COMISARIAT_GARDA_MEDIU', 'ANRE', 'ANSVSA'],
  },
  {
    id: 'administratie',
    label: 'Administrație locală',
    icon: '🏛️',
    description: 'Primării, consilii, prefecturi, urbanism, stare civilă',
    patterns: ['PRIMARI', 'CONSILIU_LOCAL', 'CONSILIUL_LOCAL', 'CONSILIU_JUDETEAN', 'CONSILIUL_JUDETEAN', 'PREFECTURA', 'URBANISM', 'STARE_CIVILA', 'SPCLEP', 'SPCEEPS', 'PASAPOARTE', 'ADMINISTRATIE_DOMENIU'],
  },
  {
    id: 'transport',
    label: 'Transport & Infrastructură',
    icon: '🛣️',
    description: 'Drumuri, auto, construcții, dezvoltare regională',
    patterns: ['MTI', 'MINISTERUL_TRANSPORTURILOR', 'CNAIR', 'RAR', 'MDLPA', 'MINISTER_DEZVOLTARE'],
  },
  {
    id: 'economie',
    label: 'Economie & Digital',
    icon: '💻',
    description: 'Digitalizare, comerț, protecția consumatorilor, telecomunicații',
    patterns: ['MCID', 'MINISTER_CERCETARE', 'ANCOM', 'ANPC', 'COMISARIAT_PROTECTIA_CONSUMATORILOR', 'ONRC', 'ORC', 'APIA', 'CENTRU_JUDETEAN_APIA', 'MADR', 'MINISTERUL_AGRICULTURII', 'INS'],
  },
  {
    id: 'aparare',
    label: 'Apărare & Siguranță',
    icon: '🛡️',
    description: 'Armată, situații de urgență, afaceri externe, drepturi',
    patterns: ['MAPN', 'MINISTERUL_APARARII', 'MAI', 'MINISTERUL_AFACERILOR_INTERNE', 'ISU', 'IJSU', 'MAE', 'MINISTER_AFACERI_EXTERNE', 'MINISTERUL_AFACERILOR_EXTERNE', 'AVOCATUL_POPORULUI', 'ANSPDCP', 'CNCD', 'ANI', 'MC', 'MINISTERUL_CULTURII', 'ANF', 'ANCPI', 'OCPI', 'POLITIE_LOCALA'],
  },
]

function institutionMatchesDomain(inst: Institutie, domain: Domeniu): boolean {
  const id = inst.id.toUpperCase()
  return domain.patterns.some(p => id.startsWith(p))
}

export function getInstitutiiByDomeniu(domeniuId: string): Institutie[] {
  const domeniu = DOMENII.find(d => d.id === domeniuId)
  if (!domeniu) return []
  return getAllInstitutii().filter(inst => institutionMatchesDomain(inst, domeniu))
}

export function getDomeniuForInstitutie(inst: Institutie): Domeniu | undefined {
  return DOMENII.find(d => institutionMatchesDomain(inst, d))
}

export interface CazPopular {
  text: string
  institutieSlug: string
  institutieNume: string
  domeniuId: string
}

export function getCazuriPopulare(limit = 8): CazPopular[] {
  const toate = getAllInstitutii()
  const cazuri: CazPopular[] = []

  for (const inst of toate) {
    if (inst.is_template) continue
    const domeniu = getDomeniuForInstitutie(inst)
    if (!domeniu) continue
    for (const caz of inst.cazuri_utilizare_544.slice(0, 2)) {
      if (caz.includes('{')) continue
      cazuri.push({
        text: caz,
        institutieSlug: inst.slug,
        institutieNume: inst.nume_scurt,
        domeniuId: domeniu.id,
      })
    }
  }

  // Pick diverse cazuri across domains
  const picked: CazPopular[] = []
  const usedDomains = new Set<string>()
  // First pass: one per domain
  for (const c of cazuri) {
    if (picked.length >= limit) break
    if (!usedDomains.has(c.domeniuId)) {
      usedDomains.add(c.domeniuId)
      picked.push(c)
    }
  }
  // Second pass: fill remaining
  for (const c of cazuri) {
    if (picked.length >= limit) break
    if (!picked.includes(c)) picked.push(c)
  }
  return picked
}
