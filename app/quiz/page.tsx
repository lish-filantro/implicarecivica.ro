import type { Metadata } from 'next'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'
import { QuizClient } from '@/components/quiz/QuizClient'

export const metadata: Metadata = {
  title: 'Quiz Civic | Implicare Civică',
  description:
    'Testează-ți cunoștințele despre Legea 544/2001, instituțiile publice din România și drepturile tale ca cetățean.',
}

export default function QuizPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <PublicNavbar activePage="/quiz" />

      <section className="pt-28 pb-16 px-6">
        <QuizClient />
      </section>

      <PublicFooter />
    </div>
  )
}
