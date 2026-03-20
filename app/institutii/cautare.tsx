'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'

interface SearchItem {
  label: string
  sublabel: string
  href: string
  type: 'institutie' | 'cerere'
}

interface Props {
  items: SearchItem[]
}

export function CautareInstitutii({ items }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return items
      .filter(
        item =>
          item.label.toLowerCase().includes(q) ||
          item.sublabel.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [query, items])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Caută instituție sau ce informație vrei să afli..."
          className="w-full pl-12 pr-4 py-4 text-base rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-civic-blue-400 dark:focus:border-civic-blue-500 focus:outline-none focus:ring-4 focus:ring-civic-blue-100 dark:focus:ring-civic-blue-900/30 transition-all"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          {results.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              onClick={() => {
                setOpen(false)
                setQuery('')
              }}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
            >
              <span className="mt-0.5 text-sm">
                {item.type === 'institutie' ? '🏛️' : '📋'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {item.sublabel}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Niciun rezultat pentru „{query}"
        </div>
      )}
    </div>
  )
}
