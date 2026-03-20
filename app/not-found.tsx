import Link from 'next/link'
import Image from 'next/image'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Nav */}
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
            <DarkModeToggle />
            <Link
              href="/institutii"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
            >
              Instituții
            </Link>
            <Link
              href="/despre"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
            >
              Despre
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="mb-8">
            <span className="text-7xl font-bold text-civic-blue-500 dark:text-civic-blue-400">
              404
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
            Pagina nu a fost găsită
          </h1>
          <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-10">
            Pagina pe care o cauți nu există sau a fost mutată.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-sm"
            >
              Înapoi la pagina principală
            </Link>
            <Link
              href="/institutii"
              className="px-6 py-3 border border-civic-blue-500 text-civic-blue-600 dark:text-civic-blue-400 font-semibold rounded-md hover:bg-civic-blue-50 dark:hover:bg-civic-blue-900/20 transition-colors text-sm"
            >
              Explorează instituțiile
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400 dark:text-gray-500">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            implicarecivica.ro
          </Link>
        </div>
      </footer>
    </div>
  )
}
