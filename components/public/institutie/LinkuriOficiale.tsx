import type { Institutie } from '@/lib/institutii'

export const linkLabels: Record<string, string> = {
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

/** Official links with an http(s) value, as [key, url] pairs in file order. */
export function officialLinks(inst: Institutie): [string, string][] {
  if (!inst.link_uri_oficiale) return []
  return Object.entries(inst.link_uri_oficiale).filter(
    ([, v]) => typeof v === 'string' && v.startsWith('http')
  )
}

/** Sidebar card "Linkuri oficiale". */
export function LinkuriOficiale({ inst }: { inst: Institutie }) {
  const links = officialLinks(inst)
  if (links.length === 0) return null
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Linkuri oficiale
      </h3>
      <div className="space-y-1.5">
        {links.map(([key, url]) => (
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
  )
}

/** Sidebar card "Baza legală". */
export function BazaLegala({ inst }: { inst: Institutie }) {
  const doc = inst.legislatie_baza?.document_principal
  if (!doc) return null
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
        Baza legală
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        {doc}
      </p>
    </div>
  )
}
