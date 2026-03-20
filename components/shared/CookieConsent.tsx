'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
          Folosim doar cookies strict necesare pentru funcționarea platformei. Fără tracking, fără publicitate.{' '}
          <Link href="/politica-cookies" className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline">
            Detalii
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-5 py-2 bg-civic-blue-500 text-white text-sm font-medium rounded-md hover:bg-civic-blue-600 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
