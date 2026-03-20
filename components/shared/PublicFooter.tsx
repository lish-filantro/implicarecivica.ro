import Link from 'next/link'
import Image from 'next/image'

export function PublicFooter() {
  return (
    <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-6">
          <Image
            src="/assets/implicare_civica_logo_navbar.png"
            alt="Implicare Civică"
            width={120}
            height={34}
            className="h-6 w-auto opacity-60"
          />
          <a href="mailto:lish@filantro.ro" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            lish@filantro.ro
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/contact" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Contact</Link>
          <span className="text-gray-200 dark:text-gray-700">|</span>
          <Link href="/politica-cookies" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Cookies</Link>
          <span className="text-gray-200 dark:text-gray-700">|</span>
          <span>Versiune beta</span>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-4">
        <p className="text-xs text-gray-300 dark:text-gray-600 text-center">
          Nu suntem avocați. Platforma facilitează exercitarea unui drept legal existent.
        </p>
      </div>
    </footer>
  )
}
