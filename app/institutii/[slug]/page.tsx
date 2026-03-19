import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getAllInstitutii, getInstitutieBySlug } from '@/lib/institutii'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'
import { Colapsabil } from './colapsabil'

export function generateStaticParams() {
  return getAllInstitutii().map(inst => ({ slug: inst.slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function InstitutieDetailPage({ params }: PageProps) {
  const { slug } = await params
  const inst = getInstitutieBySlug(slug)

  if (!inst) notFound()

  const nivelColors: Record<string, string> = {
    National: 'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/40 dark:text-civic-blue-300',
    Județean: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    Local: 'bg-grassroots-green-100 text-grassroots-green-700 dark:bg-grassroots-green-900/40 dark:text-grassroots-green-300',
  }

  const linkLabels: Record<string, string> = {
    site_principal: 'Site oficial',
    transparenta: 'Transparență decizională',
    formulare_544: 'Formulare 544',
    legislatie_organizare: 'Legislație organizare',
    rof_complet: 'ROF complet',
    portal_date: 'Portal date',
    rapoarte_activitate: 'Rapoarte activitate',
    harta_judiciara: 'Hartă judiciară',
    portal_instante: 'Portal instanțe',
    jurisprudenta: 'Jurisprudență',
    registru_hotarari: 'Registru hotărâri',
    monitorizare: 'Monitorizare',
    registru: 'Registru',
    portal: 'Portal',
    buletin_oficial: 'Buletin oficial',
    contact_online: 'Contact online',
    programari_online: 'Programări online',
  }

  const officialLinks = inst.link_uri_oficiale
    ? Object.entries(inst.link_uri_oficiale).filter(
        ([, v]) => typeof v === 'string' && v.startsWith('http')
      )
    : []

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Nav */}
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

      {/* Content */}
      <article className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-6">
            <Link href="/institutii" className="text-civic-blue-500 dark:text-civic-blue-400 hover:underline">
              Instituții
            </Link>
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">{inst.nume_scurt}</span>
          </div>

          {/* Header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${nivelColors[inst.nivel_categorie] || nivelColors.National}`}>
                {inst.nivel_categorie}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {inst.tip_institutie}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              {inst.nume_scurt}
            </h1>
            {inst.nume_oficial !== inst.nume_scurt && (
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {inst.nume_oficial}
              </p>
            )}
            {inst.is_template && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg">
                Informații generale valabile pentru toate instituțiile de tip <strong>{inst.tip_institutie.toLowerCase()}</strong> din România
                {inst.aplicabilitate && <> &mdash; {inst.aplicabilitate}</>}
              </p>
            )}
          </header>

          {/* Section 1: Ce poți cere pe 544 — MAIN CONTENT */}
          {inst.cazuri_utilizare_544.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-5">
                Ce poți cere pe Legea 544
              </h2>
              <div className="space-y-3">
                {inst.cazuri_utilizare_544.map((caz, i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-civic-blue-100 dark:bg-civic-blue-900/40 text-civic-blue-600 dark:text-civic-blue-400 flex items-center justify-center text-xs font-semibold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-[15px]">
                      {caz}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Atribuții — collapsible */}
          {inst.atributii_principale.length > 0 && (
            <section className="mb-10">
              <Colapsabil title="Ce face această instituție" subtitle={`${inst.atributii_principale.length} atribuții principale`}>
                <ul className="space-y-2.5">
                  {inst.atributii_principale.map((attr, i) => (
                    <li key={i} className="flex gap-3 text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed">
                      <span className="flex-shrink-0 text-gray-300 dark:text-gray-600 mt-0.5">&bull;</span>
                      {attr}
                    </li>
                  ))}
                </ul>
              </Colapsabil>
            </section>
          )}

          {/* Section 3: Linkuri utile */}
          {(officialLinks.length > 0 || inst.sediu) && (
            <section className="mb-10">
              <Colapsabil title="Linkuri și contact" subtitle="Resurse oficiale">
                <div className="space-y-4">
                  {/* Contact info */}
                  {inst.sediu && (
                    <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                      {inst.sediu.adresa && (
                        <p>{inst.sediu.adresa}</p>
                      )}
                      {inst.sediu.telefon && (
                        <p>Tel: {inst.sediu.telefon}</p>
                      )}
                      {inst.sediu.email && (
                        <p>Email: {inst.sediu.email}</p>
                      )}
                    </div>
                  )}

                  {/* Links */}
                  {officialLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {officialLinks.map(([key, url]) => (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-civic-blue-50 hover:text-civic-blue-600 dark:hover:bg-civic-blue-900/30 dark:hover:text-civic-blue-400 transition-colors"
                        >
                          {linkLabels[key] || key.replace(/_/g, ' ')}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-50">
                            <path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </Colapsabil>
            </section>
          )}

          {/* CTA */}
          <section className="mt-12 p-6 rounded-xl bg-civic-blue-50 dark:bg-civic-blue-900/20 border border-civic-blue-100 dark:border-civic-blue-800/30 text-center">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Vrei să trimiți o cerere pe Legea 544 către{' '}
              <strong>{inst.nume_scurt}</strong>?
            </p>
            <Link
              href="/register"
              className="inline-block px-6 py-2.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-sm"
            >
              Creează cont gratuit
            </Link>
          </section>
        </div>
      </article>

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
