import Link from 'next/link'
import { getInstitutiiByDomeniu, type Institutie, type Domeniu } from '@/lib/institutii'

/** Up to 4 non-template institutions from the same domain, excluding `inst`. */
export function institutiiSimilare(inst: Institutie, domeniu: Domeniu | undefined): Institutie[] {
  if (!domeniu) return []
  return getInstitutiiByDomeniu(domeniu.id)
    .filter(i => i.id !== inst.id && !i.is_template)
    .slice(0, 4)
}

interface Props {
  similare: Institutie[]
  domeniu?: Domeniu
}

/** "Alte instituții din domeniul X" — footer grid of related institutions. */
export function InstitutiiRelated({ similare, domeniu }: Props) {
  if (similare.length === 0) return null
  return (
    <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
        {domeniu?.icon} Alte instituții din domeniul {domeniu?.label}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {similare.map(s => (
          <Link
            key={s.id}
            href={`/institutii/${s.slug}`}
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-civic-blue-300 dark:hover:border-civic-blue-600 hover:shadow-sm transition-all group"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors leading-snug">
              {s.nume_scurt}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {s.cazuri_utilizare_544.length} cereri posibile
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
