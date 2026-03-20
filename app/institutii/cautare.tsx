'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface SearchEntry {
  slug: string
  numeScurt: string
  numeOficial: string
  haystack: string
}

interface Props {
  index: SearchEntry[]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

export function CautareInstitutii({ index }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (query.length < 2) return []
    const words = normalize(query).split(/\s+/).filter(w => w.length >= 2)
    if (words.length === 0) return []

    const scored = index.map(entry => {
      let score = 0
      for (const word of words) {
        if (entry.haystack.includes(word)) {
          score++
          const normName = normalize(entry.numeScurt + ' ' + entry.numeOficial)
          if (normName.includes(word)) score += 2
        }
      }
      return { entry, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.entry)
  }, [query, index])

  // Reset active index when results change
  useEffect(() => setActiveIdx(-1), [results])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => (i <= 0 ? results.length - 1 : i - 1))
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault()
        const entry = results[activeIdx]
        window.location.href = `/institutii/${entry.slug}`
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    },
    [open, results, activeIdx]
  )

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
          onKeyDown={handleKeyDown}
          placeholder="Caută instituție sau descrie ce vrei să afli..."
          className="w-full pl-12 pr-4 py-4 text-base rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-civic-blue-400 dark:focus:border-civic-blue-500 focus:outline-none focus:ring-4 focus:ring-civic-blue-100 dark:focus:ring-civic-blue-900/30 transition-all"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          {results.map((entry, i) => (
            <Link
              key={entry.slug}
              href={`/institutii/${entry.slug}`}
              onClick={() => {
                setOpen(false)
                setQuery('')
              }}
              className={`flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 ${
                i === activeIdx
                  ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="text-sm shrink-0">🏛️</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {entry.numeOficial}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {entry.numeScurt}
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
