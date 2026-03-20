import type { Metadata } from 'next'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'

export const metadata: Metadata = {
  title: 'Contact | Implicare Civică',
  description:
    'Contactează echipa Implicare Civică. Trimite întrebări, sugestii sau feedback despre platformă.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Nav */}
      <PublicNavbar />

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
      <PublicFooter />
    </div>
  )
}
