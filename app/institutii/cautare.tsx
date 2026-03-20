'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface SearchEntry {
  slug: string
  numeScurt: string
  numeOficial: string
  haystack: string
  words: string[]
}

interface Props {
  index: SearchEntry[]
}

/** Strip diacritics and lowercase */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

/**
 * Edit distance between two short strings (Levenshtein).
 * Bails out early if distance exceeds maxDist.
 */
function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length
  const n = b.length
  // Single-row DP
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    row[0] = i
    let rowMin = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = row[j]
      row[j] = val
      if (val < rowMin) rowMin = val
    }
    if (rowMin > maxDist) return maxDist + 1
  }
  return row[n]
}

/** Max allowed edit distance based on word length */
function maxTypos(len: number): number {
  if (len <= 3) return 0
  if (len <= 4) return 1
  return 2
}

/**
 * Score a query word against an entry.
 * Returns 0 (no match) or a positive score.
 */
function scoreWord(
  qWord: string,
  entry: SearchEntry,
  normName: string
): number {
  // 1. Exact substring in full haystack — best signal
  if (entry.haystack.includes(qWord)) {
    return normName.includes(qWord) ? 7 : 3
  }

  // 2. Fuzzy: find the closest word in the entry's word list
  const allowed = maxTypos(qWord.length)
  if (allowed === 0) return 0

  let bestDist = allowed + 1
  for (const w of entry.words) {
    // Only compare words of similar length
    if (Math.abs(w.length - qWord.length) > allowed) continue
    const d = editDistance(qWord, w, allowed)
    if (d < bestDist) bestDist = d
    if (d <= 1) break // good enough, stop early
  }

  if (bestDist <= allowed) {
    const fuzzyScore = 2 - bestDist * 0.5 // 2 for dist=0 (shouldn't happen), 1.5 for dist=1, 1 for dist=2
    // Check if fuzzy match is in the name
    const nameWords = normName.split(/[^a-z]+/).filter(w => w.length >= 3)
    for (const nw of nameWords) {
      if (Math.abs(nw.length - qWord.length) <= allowed) {
        if (editDistance(qWord, nw, allowed) <= allowed) {
          return fuzzyScore + 3
        }
      }
    }
    return fuzzyScore
  }

  return 0
}

export function CautareInstitutii({ index }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (query.length < 2) return []
    const qWords = normalize(query).split(/\s+/).filter(w => w.length >= 2)
    if (qWords.length === 0) return []

    const scored = index.map(entry => {
      const normName = normalize(entry.numeScurt + ' ' + entry.numeOficial)
      let total = 0
      for (const qw of qWords) {
        total += scoreWord(qw, entry, normName)
      }
      return { entry, score: total }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.entry)
  }, [query, index])

  useEffect(() => setActiveIdx(-1), [results])

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
