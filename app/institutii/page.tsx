import Link from 'next/link'
import Image from 'next/image'
import { getAllInstitutii, type Institutie } from '@/lib/institutii'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'
import { InstitutiiTabs } from './tabs'

const niveluri = ['National', 'Județean', 'Local'] as const

export default function InstitutiiPage() {
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
      {/* Nav — same as landing */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/assets/implicare_civica_logo_navbar.png"
              alt="Implicare Civică"
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <Link
              href="/institutii"
              className="text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400"
            >
              Instituții
            </Link>
            <Link
              href="/despre"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
            >
              Despre
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
            >
              Autentificare
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline mb-4 inline-block"
          >
            &larr; Înapoi la pagina principală
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Instituții publice
          </h1>
          <p className="mt-3 text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
            Ce poți cere pe Legea 544/2001 de la fiecare instituție din România.
          </p>
        </div>
      </section>

      {/* Tabs + Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <InstitutiiTabs grouped={grouped} />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400 dark:text-gray-500">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            implicarecivica.ro
          </Link>
          {' '}&mdash; Platformă în versiune beta
        </div>
      </footer>
    </div>
  )
}
