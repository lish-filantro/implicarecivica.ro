import Link from 'next/link'
import type { Institutie } from '@/lib/institutii'

/** Contact details used for Law 544 requests: the procedura_544 values win over the sediu ones. */
export function contactCereri(inst: Institutie) {
  const proc = inst.procedura_544
  return {
    departament: proc?.departament_responsabil,
    email: proc?.contact_cereri || inst.sediu?.email,
    telefon: proc?.telefon_cereri || inst.sediu?.telefon,
    adresa: inst.sediu?.adresa,
  }
}

const icon = 'w-4 h-4 text-gray-400 shrink-0'
const contactLink =
  'flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors'

/** Sidebar card "Trimite o cerere 544": department, email, phone, address, register CTA. */
export function Procedura544({ inst }: { inst: Institutie }) {
  const { departament, email, telefon, adresa } = contactCereri(inst)
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Trimite o cerere 544
      </h3>

      {departament && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Departament responsabil:{' '}
          <span className="text-gray-700 dark:text-gray-300">
            {departament}
          </span>
        </p>
      )}

      <div className="space-y-2.5 mb-5">
        {email && (
          <a href={`mailto:${email}`} className={contactLink}>
            <svg className={icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {email}
          </a>
        )}
        {telefon && (
          <a href={`tel:${telefon.replace(/[^+\d]/g, '')}`} className={contactLink}>
            <svg className={icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            {telefon}
          </a>
        )}
        {adresa && (
          <div className="flex items-start gap-2.5 text-sm text-gray-500 dark:text-gray-400">
            <svg className={`${icon} mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <span className="text-xs leading-relaxed">{adresa}</span>
          </div>
        )}
      </div>

      <Link
        href="/register"
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-civic-blue-500 text-white font-semibold rounded-lg hover:bg-civic-blue-600 transition-colors text-sm"
      >
        Trimite o cerere
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </Link>
    </div>
  )
}
