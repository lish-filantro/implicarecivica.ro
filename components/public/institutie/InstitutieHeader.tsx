import Link from 'next/link'
import type { Institutie, Domeniu } from '@/lib/institutii'

export const nivelColors: Record<string, string> = {
  National:
    'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/40 dark:text-civic-blue-300',
  Județean:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Local:
    'bg-grassroots-green-100 text-grassroots-green-700 dark:bg-grassroots-green-900/40 dark:text-grassroots-green-300',
}

interface Props {
  inst: Institutie
  domeniu?: Domeniu
}

/** Breadcrumb + page header (level badge, official name, template note, first attribution). */
export function InstitutieHeader({ inst, domeniu }: Props) {
  return (
    <>
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
    </>
  )
}
