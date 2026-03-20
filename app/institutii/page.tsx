import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getAllInstitutii,
  DOMENII,
  getInstitutiiByDomeniu,
  getCazuriPopulare,
  getSearchIndex,
} from '@/lib/institutii'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'
import { CautareInstitutii } from './cautare'
import { DomeniiGrid } from './domenii-grid'

export const metadata: Metadata = {
  title: 'Instituții publice | Implicare Civică',
  description:
    'Explorează instituțiile publice din România. Află ce informații poți cere pe Legea 544/2001 de la fiecare instituție.',
}

export default function InstitutiiPage() {
  const toate = getAllInstitutii()
  const cazuriPopulare = getCazuriPopulare(8)

  const searchIndex = getSearchIndex()

  // Build domain data
  const domeniiData = DOMENII.map(d => ({
    id: d.id,
    label: d.label,
    icon: d.icon,
    description: d.description,
    institutii: getInstitutiiByDomeniu(d.id),
  })).filter(d => d.institutii.length > 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <PublicNavbar activePage="/institutii" />

      {/* Hero + Search */}
      <section className="pt-24 pb-10 px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/"
            className="text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-6 inline-block"
          >
            &larr; Înapoi la pagina principală
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Ce vrei să afli de la stat?
          </h1>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Caută o instituție sau descrie ce informație ai nevoie.
            Legea 544/2001 îți dă dreptul să întrebi.
          </p>
          <div className="mt-8">
            <CautareInstitutii index={searchIndex} />
          </div>
        </div>
      </section>

      {/* Popular requests */}
      <section className="py-10 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
            Exemple de cereri populare
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {cazuriPopulare.map((caz, i) => (
              <Link
                key={i}
                href={`/institutii/${caz.institutieSlug}`}
                className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-civic-blue-300 dark:hover:border-civic-blue-600 hover:shadow-sm transition-all group"
              >
                <span className="text-civic-blue-500 dark:text-civic-blue-400 mt-0.5 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-200 group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors leading-snug">
                    {caz.text}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {caz.institutieNume}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Domains */}
      <section className="pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
            Explorează pe domenii
          </h2>
          <DomeniiGrid domenii={domeniiData} />
        </div>
      </section>

      {/* All institutions fallback link */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {toate.length} instituții disponibile ·{' '}
            <Link
              href="/institutii/toate"
              className="text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
            >
              Vezi lista completă
            </Link>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
