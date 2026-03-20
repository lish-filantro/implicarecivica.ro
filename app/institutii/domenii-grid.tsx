'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Institutie } from '@/lib/institutii'

interface DomeniuData {
  id: string
  label: string
  icon: string
  description: string
  institutii: Institutie[]
}

interface Props {
  domenii: DomeniuData[]
}

function InstitutieRow({ inst }: { inst: Institutie }) {
  return (
    <Link
      href={`/institutii/${inst.slug}`}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors truncate">
          {inst.nume_oficial}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {inst.tip_institutie}
          {' · '}
          {inst.cazuri_utilizare_544.length} cereri posibile
        </p>
      </div>
      <svg
        className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-civic-blue-500 transition-colors shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export function DomeniiGrid({ domenii }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {/* Grid of domain cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {domenii.map(d => {
          const isExpanded = expanded === d.id
          return (
            <button
              key={d.id}
              onClick={() => setExpanded(isExpanded ? null : d.id)}
              className={`text-left p-5 rounded-xl border-2 transition-all ${
                isExpanded
                  ? 'border-civic-blue-400 dark:border-civic-blue-500 bg-civic-blue-50/50 dark:bg-civic-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl" role="img">{d.icon}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isExpanded
                    ? 'bg-civic-blue-100 dark:bg-civic-blue-800 text-civic-blue-700 dark:text-civic-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {d.institutii.length}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                {d.label}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {d.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Expanded domain: show institutions */}
      {expanded && (() => {
        const d = domenii.find(d => d.id === expanded)
        if (!d) return null
        return (
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{d.icon}</span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {d.label}
                </h3>
              </div>
              <button
                onClick={() => setExpanded(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {d.institutii.map(inst => (
                <InstitutieRow key={inst.id} inst={inst} />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
