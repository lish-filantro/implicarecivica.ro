import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllInstitutii, getInstitutieBySlug } from '@/lib/institutii'
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
      <PublicNavbar activePage="/institutii" />

      {/* Content */}
      <article className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-8">
            <Link href="/institutii" className="text-civic-blue-500 dark:text-civic-blue-400 hover:underline">
              Instituții
            </Link>
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">{inst.nume_scurt}</span>
          </div>

          {/* Header */}
          <header className="mb-12">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${nivelColors[inst.nivel_categorie] || nivelColors.National}`}>
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
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg">
                Informații generale valabile pentru toate instituțiile de tip <strong>{inst.tip_institutie.toLowerCase()}</strong> din România
                {inst.aplicabilitate && <> &mdash; {inst.aplicabilitate}</>}
              </p>
            )}
          </header>

          {/* Summary box: Ce poți afla — MAIN CONTENT */}
          {inst.cazuri_utilizare_544.length > 0 && (
            <section className="mb-12 rounded-xl bg-civic-blue-50/50 dark:bg-civic-blue-900/10 border border-civic-blue-100 dark:border-civic-blue-800/30 p-6 md:p-8">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">
                Ce poți afla de la {inst.nume_scurt}
              </h2>
              <ul className="space-y-3 mb-6">
                {inst.cazuri_utilizare_544.map((caz, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed"
                  >
                    <span className="flex-shrink-0 text-civic-blue-400 dark:text-civic-blue-500 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {caz}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-sm"
              >
                Trimite o cerere
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </Link>
            </section>
          )}

          {/* Accordion: Atribuții */}
          {inst.atributii_principale.length > 0 && (
            <section className="mb-4">
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

          {/* Accordion: Contact & linkuri */}
          {(officialLinks.length > 0 || inst.sediu) && (
            <section className="mb-4">
              <Colapsabil title="Linkuri și contact" subtitle="Resurse oficiale">
                <div className="space-y-5">
                  {/* Contact as summary list (key-value pairs) */}
                  {inst.sediu && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      {inst.sediu.adresa && (
                        <>
                          <dt className="text-gray-400 dark:text-gray-500 font-medium">Adresă</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{inst.sediu.adresa}</dd>
                        </>
                      )}
                      {inst.sediu.telefon && (
                        <>
                          <dt className="text-gray-400 dark:text-gray-500 font-medium">Telefon</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{inst.sediu.telefon}</dd>
                        </>
                      )}
                      {inst.sediu.email && (
                        <>
                          <dt className="text-gray-400 dark:text-gray-500 font-medium">Email</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{inst.sediu.email}</dd>
                        </>
                      )}
                    </dl>
                  )}

                  {/* Links as pill buttons */}
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
        </div>
      </article>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
