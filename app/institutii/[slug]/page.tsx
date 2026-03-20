import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getAllInstitutii,
  getInstitutieBySlug,
  getDomeniuForInstitutie,
  getInstitutiiByDomeniu,
} from '@/lib/institutii'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'
import { Colapsabil } from './colapsabil'

export function generateStaticParams() {
  return getAllInstitutii().map(inst => ({ slug: inst.slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const inst = getInstitutieBySlug(slug)
  if (!inst) {
    return { title: 'Instituție negăsită | Implicare Civică' }
  }
  return {
    title: `${inst.nume_scurt} | Implicare Civică`,
    description: `Informații despre ${inst.nume_oficial}. Află ce poți cere pe Legea 544/2001 și cum să trimiți o cerere de informații publice.`,
  }
}

const nivelColors: Record<string, string> = {
  National:
    'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/40 dark:text-civic-blue-300',
  Județean:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Local:
    'bg-grassroots-green-100 text-grassroots-green-700 dark:bg-grassroots-green-900/40 dark:text-grassroots-green-300',
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

export default async function InstitutieDetailPage({ params }: PageProps) {
  const { slug } = await params
  const inst = getInstitutieBySlug(slug)

  if (!inst) notFound()

  const domeniu = getDomeniuForInstitutie(inst)
  const similare = domeniu
    ? getInstitutiiByDomeniu(domeniu.id)
        .filter(i => i.id !== inst.id && !i.is_template)
        .slice(0, 4)
    : []

  const officialLinks = inst.link_uri_oficiale
    ? Object.entries(inst.link_uri_oficiale).filter(
        ([, v]) => typeof v === 'string' && v.startsWith('http')
      )
    : []

  const proc = inst.procedura_544
  const emailCereri = proc?.contact_cereri || inst.sediu?.email
  const telefonCereri = proc?.telefon_cereri || inst.sediu?.telefon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <PublicNavbar activePage="/institutii" />

      <article className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-6">
            <Link
              href="/institutii"
              className="text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
            >
              Instituții
            </Link>
            {domeniu && (
              <>
                <span>/</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {domeniu.icon} {domeniu.label}
                </span>
              </>
            )}
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">{inst.nume_scurt}</span>
          </div>

          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${nivelColors[inst.nivel_categorie] || nivelColors.National}`}
              >
                {inst.nivel_categorie}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {inst.tip_institutie}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-snug">
              {inst.nume_oficial}
            </h1>
            {inst.is_template && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                Informații generale valabile pentru toate instituțiile de tip{' '}
                <strong>{inst.tip_institutie.toLowerCase()}</strong> din România
                {inst.aplicabilitate && <> &mdash; {inst.aplicabilitate}</>}
              </p>
            )}
            {inst.atributii_principale.length > 0 && (
              <p className="mt-3 text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {inst.atributii_principale[0]}
              </p>
            )}
          </header>

          {/* 2-column layout */}
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            {/* Main column */}
            <div className="space-y-8">
              {/* Cazuri 544 — action cards */}
              {inst.cazuri_utilizare_544.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
                    Ce poți cere de la {inst.nume_scurt}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {inst.cazuri_utilizare_544.map((caz, i) => (
                      <Link
                        key={i}
                        href="/register"
                        className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-civic-blue-300 dark:hover:border-civic-blue-600 hover:shadow-sm transition-all group"
                      >
                        <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/30 flex items-center justify-center">
                          <svg
                            className="w-3.5 h-3.5 text-civic-blue-500 dark:text-civic-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors leading-snug">
                          {caz}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Atribuții — first one already shown in header, rest expandable */}
              {inst.atributii_principale.length > 1 && (
                <section>
                  <Colapsabil
                    title="Ce face această instituție"
                    subtitle={`${inst.atributii_principale.length} atribuții principale`}
                  >
                    <ul className="space-y-2.5">
                      {inst.atributii_principale.map((attr, i) => (
                        <li
                          key={i}
                          className="flex gap-3 text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed"
                        >
                          <span className="flex-shrink-0 text-gray-300 dark:text-gray-600 mt-0.5">
                            &bull;
                          </span>
                          {attr}
                        </li>
                      ))}
                    </ul>
                  </Colapsabil>
                </section>
              )}

              {/* Contestații */}
              {proc?.contestatii && (
                <section className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                    Dacă nu primești răspuns
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                    {proc.contestatii}
                  </p>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-5 lg:order-last">
              {/* Contact card for 544 requests */}
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Trimite o cerere 544
                </h3>

                {proc?.departament_responsabil && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Departament responsabil:{' '}
                    <span className="text-gray-700 dark:text-gray-300">
                      {proc.departament_responsabil}
                    </span>
                  </p>
                )}

                <div className="space-y-2.5 mb-5">
                  {emailCereri && (
                    <a
                      href={`mailto:${emailCereri}`}
                      className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {emailCereri}
                    </a>
                  )}
                  {telefonCereri && (
                    <a
                      href={`tel:${telefonCereri.replace(/[^+\d]/g, '')}`}
                      className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      {telefonCereri}
                    </a>
                  )}
                  {inst.sediu?.adresa && (
                    <div className="flex items-start gap-2.5 text-sm text-gray-500 dark:text-gray-400">
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-xs leading-relaxed">{inst.sediu.adresa}</span>
                    </div>
                  )}
                </div>

                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-civic-blue-500 text-white font-semibold rounded-lg hover:bg-civic-blue-600 transition-colors text-sm"
                >
                  Trimite o cerere
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
              </div>

              {/* Official links */}
              {officialLinks.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Linkuri oficiale
                  </h3>
                  <div className="space-y-1.5">
                    {officialLinks.map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors py-1"
                      >
                        <svg
                          className="w-3.5 h-3.5 opacity-40 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        {linkLabels[key] || key.replace(/_/g, ' ')}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Legislație */}
              {inst.legislatie_baza?.document_principal && (
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Baza legală
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {inst.legislatie_baza.document_principal}
                  </p>
                </div>
              )}
            </aside>
          </div>

          {/* Similar institutions */}
          {similare.length > 0 && (
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
          )}
        </div>
      </article>

      <PublicFooter />
    </div>
  )
}
