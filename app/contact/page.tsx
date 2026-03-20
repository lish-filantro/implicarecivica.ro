import Link from 'next/link'
import Image from 'next/image'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

export default function ContactPage() {
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
            <Link href="/institutii" className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors">
              Instituții
            </Link>
            <Link href="/despre" className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors">
              Despre
            </Link>
            <Link href="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors">
              Autentificare
            </Link>
            <Link href="/register" className="text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors">
              Creează cont
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-6">
            Contact
          </h1>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-10">
            Ai o întrebare, o sugestie sau vrei să te implici? Scrie-ne. Răspundem la toate mesajele.
          </p>

          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Email</h2>
              <a href="mailto:lish@filantro.ro" className="text-lg text-civic-blue-600 dark:text-civic-blue-400 hover:underline">
                lish@filantro.ro
              </a>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Feedback despre platformă</h2>
              <a
                href="mailto:lish@filantro.ro?subject=Feedback%20platformă"
                className="inline-block px-5 py-2.5 bg-civic-blue-500 text-white font-medium rounded-md hover:bg-civic-blue-600 transition-colors text-sm"
              >
                Trimite feedback și sugestii
              </a>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Raportează o problemă</h2>
              <a
                href="mailto:lish@filantro.ro?subject=Bug%20report%20platformă"
                className="text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
              >
                Trimite un email cu detalii despre problema întâmpinată
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-6">
            <Image src="/assets/implicare_civica_logo_navbar.png" alt="Implicare Civică" width={120} height={34} className="h-6 w-auto opacity-60" />
            <a href="mailto:lish@filantro.ro" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">lish@filantro.ro</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/politica-cookies" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Cookies & Confidențialitate</Link>
            <span className="text-gray-200 dark:text-gray-700">|</span>
            <span>Versiune beta</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
