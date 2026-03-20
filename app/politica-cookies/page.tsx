import Link from 'next/link'
import Image from 'next/image'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

export default function PoliticaCookiesPage() {
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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            Politica de cookies și confidențialitate
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">
            Ultima actualizare: 20 martie 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            {/* Cookies */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Cookies</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                Folosim un număr minim de cookies, strict necesare pentru funcționarea platformei:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">Cookie</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">Scop</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">Durată</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2.5 font-mono text-xs">cookie-consent</td>
                      <td className="px-4 py-2.5">Memorează alegerea ta privind cookies</td>
                      <td className="px-4 py-2.5">1 an</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2.5 font-mono text-xs">sb-*-auth-token</td>
                      <td className="px-4 py-2.5">Sesiunea de autentificare (Supabase)</td>
                      <td className="px-4 py-2.5">Sesiune</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2.5 font-mono text-xs">theme</td>
                      <td className="px-4 py-2.5">Preferința dark/light mode</td>
                      <td className="px-4 py-2.5">1 an</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
                Nu folosim cookies de tracking, publicitate sau analytics de la terți.
              </p>
            </div>

            {/* Date personale */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Date personale</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                Colectăm doar datele necesare funcționării platformei:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-400">
                <li>Adresa de email — pentru autentificare și notificări</li>
                <li>Numele — pentru personalizarea cererilor 544</li>
                <li>Conținutul cererilor trimise — pentru funcționalitatea de urmărire</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mt-3">
                Datele sunt stocate în Supabase (infrastructure EU). Nu vindem, nu partajăm și nu monetizăm datele tale.
              </p>
            </div>

            {/* Drepturile tale */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Drepturile tale</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                Conform GDPR, ai dreptul să:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-400">
                <li>Accesezi datele personale pe care le deținem</li>
                <li>Rectifici datele incorecte</li>
                <li>Soliciți ștergerea contului și a datelor asociate</li>
                <li>Exporți datele tale într-un format standard</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mt-3">
                Pentru orice solicitare:{' '}
                <a href="mailto:lish@filantro.ro?subject=GDPR%20—%20Solicitare" className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline">
                  lish@filantro.ro
                </a>
              </p>
            </div>

            {/* Open source */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transparență</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Platforma este open source. Poți verifica exact ce date colectăm și cum le procesăm inspectând codul sursă.
              </p>
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
            <Link href="/contact" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Contact</Link>
            <span className="text-gray-200 dark:text-gray-700">|</span>
            <span>Versiune beta</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
