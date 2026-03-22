import Link from 'next/link'
import Image from 'next/image'
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

export function PublicNavbar({ activePage }: PublicNavbarProps) {
  return (
    <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/">
          <Image
            src="/assets/implicare_civica_logo_navbar.png"
            alt="Implicare Civică"
            width={140}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                activePage === link.href
                  ? 'text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400'
                  : 'text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors'
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors"
          >
            Intră în cont
          </Link>
          <DarkModeToggle />
        </div>
      </div>
    </nav>
  )
}
