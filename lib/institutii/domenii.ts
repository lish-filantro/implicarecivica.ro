/**
 * Thematic grouping of institutions: each domain lists institution-id prefixes.
 */
import type { Domeniu, Institutie } from './types'
import { getAllInstitutii } from './load'

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
    description: 'Spitale, medici, programe de sănătate, asigurări, creșe',
    patterns: ['MINISTERUL_SANATATII', 'MS', 'CJAS', 'CNAS', 'DSP', 'ANMCS', 'ANMDMR', 'SPITAL', 'CRESA'],
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
    description: 'Protecția mediului, energie, ape, păduri, salubritate',
    patterns: ['MMAP', 'MINISTERUL_MEDIULUI', 'APM', 'ANPM', 'GNM', 'COMISARIAT_GARDA_MEDIU', 'ANRE', 'ANSVSA', 'SERVICIU_SALUBRITATE', 'DIRECTIA_SILVICA'],
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
    description: 'Drumuri, auto, construcții, transport public, utilități',
    patterns: ['MTI', 'MINISTERUL_TRANSPORTURILOR', 'CNAIR', 'RAR', 'MDLPA', 'MINISTER_DEZVOLTARE', 'SERVICIU_TRANSPORT', 'SERVICIU_ALIMENTARE_APA', 'SERVICIU_TERMOFICARE'],
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
    description: 'Armată, situații de urgență, afaceri externe, drepturi, cultură',
    patterns: ['MAPN', 'MINISTERUL_APARARII', 'MAI', 'MINISTERUL_AFACERILOR_INTERNE', 'ISU', 'IJSU', 'MAE', 'MINISTER_AFACERI_EXTERNE', 'MINISTERUL_AFACERILOR_EXTERNE', 'AVOCATUL_POPORULUI', 'ANSPDCP', 'CNCD', 'ANI', 'MC', 'MINISTERUL_CULTURII', 'ANF', 'ANCPI', 'OCPI', 'POLITIE_LOCALA', 'CASA_DE_CULTURA', 'MUZEU_LOCAL'],
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
