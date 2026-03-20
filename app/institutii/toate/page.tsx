import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllInstitutii, type Institutie } from '@/lib/institutii'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'
import { InstitutiiTabs } from '../tabs'

export const metadata: Metadata = {
  title: 'Toate instituțiile | Implicare Civică',
  description: 'Lista completă a instituțiilor publice din România.',
}

export default function ToateInstitutiile() {
  const toate = getAllInstitutii()

  const grouped: Record<string, Institutie[]> = {
    National: [],
    Județean: [],
    Local: [],
  }
  for (const inst of toate) {
    grouped[inst.nivel_categorie].push(inst)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <PublicNavbar activePage="/institutii" />

      <section className="pt-24 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/institutii"
            className="text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-4 inline-block"
          >
            &larr; Înapoi la explorare
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Toate instituțiile
          </h1>
          <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
            {toate.length} instituții publice, grupate pe nivel administrativ.
          </p>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <InstitutiiTabs grouped={grouped} />
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
