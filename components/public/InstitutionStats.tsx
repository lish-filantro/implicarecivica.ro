'use client'

/**
 * Open-data card on the public institution page: fetches
 * /api/public/institutii-stats at runtime and renders nothing while loading or
 * on error, so the static page is never blocked by the database.
 */
import { useEffect, useState } from 'react'
import type { InstitutionStats as Stats } from '@m544/public-stats/aggregate'

interface Props {
  nume: string
  slug: string
  fetcher?: typeof fetch
}

export const STATS_TITLE = 'Date deschise din cererile trimise prin platformă'
export const INSUFFICIENT_TEXT = 'Încă nu avem suficiente cereri pentru statistici publice.'

export function statsUrl(nume: string, slug: string): string {
  return `/api/public/institutii-stats?${new URLSearchParams({ nume, slug })}`
}

function isStats(value: unknown): value is Stats {
  return typeof value === 'object' && value !== null && typeof (value as Stats).total === 'number'
}

const dash = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '–' : `${v}${suffix}`)

export function InstitutionStats({ nume, slug, fetcher = fetch }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false
    fetcher(statsUrl(nume, slug))
      .then(res => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!cancelled && isStats(data)) setStats(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [nume, slug, fetcher])

  if (!stats) return null

  if (stats.insufficient) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">{INSUFFICIENT_TEXT}</p>
  }

  const items: Array<[string, string]> = [
    ['Cereri trimise', String(stats.total)],
    ['Răspunsuri', dash(stats.answered)],
    ['Întârziate', dash(stats.delayed)],
    ['Mediană zile până la răspuns', dash(stats.median_days_to_answer)],
    ['Răspunsuri în termen', dash(stats.answered_within_deadline_pct, '%')],
  ]

  return (
    <section
      aria-label={STATS_TITLE}
      className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{STATS_TITLE}</h3>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-400 dark:text-gray-500 leading-snug">{label}</dt>
            <dd className="text-lg font-semibold text-gray-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
