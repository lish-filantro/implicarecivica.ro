/**
 * Curated institution knowledge base — re-export barrel.
 * Implementation lives in lib/institutii/{types,load,domenii,cazuri,search-index}.ts;
 * existing `@/lib/institutii` imports keep working unchanged.
 */
export type {
  Procedura544,
  KeywordsCautare,
  NivelCategorie,
  Institutie,
  Domeniu,
  CazPopular,
  SearchEntry,
} from './institutii/types'
export { getAllInstitutii, getInstitutieBySlug, getInstitutiiByNivel } from './institutii/load'
export { DOMENII, getInstitutiiByDomeniu, getDomeniuForInstitutie } from './institutii/domenii'
export { getCazuriPopulare } from './institutii/cazuri'
export { getSearchIndex } from './institutii/search-index'
