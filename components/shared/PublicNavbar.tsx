'use client'

/**
 * Navbarul public. Sub breakpointul `md` cele cinci linkuri plus CTA-ul de login nu încap pe un
 * rând şi devin ilizibile, aşa că se mută într-un panou deschis de un buton hamburger — la fel ca
 * în zona logată. Componenta a fost server component; are stare, deci `'use client'`.
 */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

const navLinks = [
  { href: '/institutii', label: 'Instituții' },
  { href: '/alegeri-locale-2024', label: 'Alegeri 2024' },
  { href: '/quiz', label: 'Quiz' },
  { href: '/despre', label: 'Despre' },
  { href: '/contact', label: 'Contact' },
]

interface PublicNavbarProps {
  activePage?: string
}

function linkClass(active: boolean): string {
  return active
    ? 'text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400'
    : 'text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors'
}

const ctaClass =
  'text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors'

export function PublicNavbar({ activePage }: PublicNavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" onClick={() => setOpen(false)}>
          <Image
            src="/assets/implicare_civica_logo_navbar.png"
            alt="Implicare Civică"
            width={140}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(activePage === link.href)}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={ctaClass}>
            Intră în cont
          </Link>
          <DarkModeToggle />
        </div>

        <div className="flex md:hidden items-center gap-2">
          <DarkModeToggle />
          <button
            type="button"
            aria-label="Meniu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="p-2 -mr-2 text-gray-700 dark:text-gray-300 rounded-md
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          role="navigation"
          aria-label="Meniu mobil"
          className="md:hidden border-t border-gray-100 dark:border-gray-800
                     bg-white dark:bg-gray-900 px-6 py-4 flex flex-col gap-4"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={linkClass(activePage === link.href)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className={`${ctaClass} text-center`}>
            Intră în cont
          </Link>
        </div>
      )}
    </nav>
  )
}
