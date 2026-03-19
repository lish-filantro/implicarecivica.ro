'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Institutie } from '@/lib/institutii'

const niveluri = [
  { key: 'National', label: 'Național', desc: 'Ministere, agenții, autorități centrale' },
  { key: 'Județean', label: 'Județean', desc: 'Prefecturi, inspectorate, direcții județene' },
  { key: 'Local', label: 'Local', desc: 'Primării, consilii locale, servicii publice locale' },
] as const

interface Props {
  grouped: Record<string, Institutie[]>
}

function InstitutieCard({ inst }: { inst: Institutie }) {
  // Show up to 3 cazuri as preview
  const previewCazuri = inst.cazuri_utilizare_544.slice(0, 3)

  return (
    <Link
      href={`/institutii/${inst.slug}`}
      className="block p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-civic-blue-300 dark:hover:border-civic-blue-600 hover:shadow-md dark:hover:shadow-civic-blue-900/20 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-civic-blue-600 dark:group-hover:text-civic-blue-400 transition-colors">
          {inst.nume_scurt}
        </h3>
        {inst.is_template && (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            Generic
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {inst.tip_institutie}
      </p>

      {previewCazuri.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400">
            Exemple de cereri 544
          </p>
          {previewCazuri.map((caz, i) => (
            <p key={i} className="text-sm text-gray-600 dark:text-gray-300 leading-snug pl-3 border-l-2 border-gray-200 dark:border-gray-600">
              {caz.length > 100 ? caz.slice(0, 100) + '…' : caz}
            </p>
          ))}
        </div>
      )}
    </Link>
  )
}

export function InstitutiiTabs({ grouped }: Props) {
  const [activeTab, setActiveTab] = useState<string>('National')

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-8">
        {niveluri.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
              ({grouped[key]?.length || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {niveluri.find(n => n.key === activeTab)?.desc}
      </p>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {grouped[activeTab]?.map(inst => (
          <InstitutieCard key={inst.id} inst={inst} />
        ))}
      </div>
    </div>
  )
}
