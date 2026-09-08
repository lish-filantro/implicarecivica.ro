/**
 * "Popular requests" teaser for /institutii: concrete Law 544 use cases picked
 * across domains (one per domain first, then fill up to the limit).
 */
import type { CazPopular } from './types'
import { getAllInstitutii } from './load'
import { getDomeniuForInstitutie } from './domenii'

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
