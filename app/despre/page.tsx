import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNavbar } from '@/components/shared/PublicNavbar'
import { PublicFooter } from '@/components/shared/PublicFooter'

export const metadata: Metadata = {
  title: 'Despre | Implicare Civică',
  description:
    'Construim unelte civice pentru o administrație care răspunde. Platformă open source pentru transparență și acces la informații publice în România.',
}

const ceConstructim = [
  {
    titlu: 'Înțelege cine te guvernează',
    desc: 'Informații clare despre instituțiile publice din România — ce fac, ce obligații au, ce poți cere de la ele. Începând de la primărie.',
  },
  {
    titlu: 'Cere informații, nu permisiunea',
    desc: 'Unelte care te ajută să trimiți cereri pe Legea 544/2001 și să urmărești dacă instituțiile răspund în termen. Fără jargon juridic, fără formulare complicate.',
  },
  {
    titlu: 'Transformă răspunsurile în date deschise',
    desc: 'Fiecare răspuns primit devine open data. Analizăm cum performează instituțiile: cine răspunde, cine ignoră, cine întârzie.',
  },
  {
    titlu: 'Campanii de presiune civică',
    desc: 'Când o instituție refuză transparența, nu rămâi singur. Facilităm campanii coordonate — mai multe cereri, mai multă vizibilitate, mai greu de ignorat.',
  },
  {
    titlu: 'Colaborare între actori civici',
    desc: 'Cetățeni, jurnaliști, ONG-uri — toți cer aceleași informații, separat. Platforma conectează eforturile pentru impact mai mare.',
  },
]

export default function DesprePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Nav */}
      <PublicNavbar activePage="/despre" />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Construim unelte civice pentru
            <br />
            <span className="text-civic-blue-500 dark:text-civic-blue-400">o administrație care răspunde.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Implicare Civică este o platformă care pune la dispoziția cetățenilor instrumentele necesare pentru a înțelege cum funcționează instituțiile publice, pentru a cere informații de interes public și pentru a crea presiune civică acolo unde transparența lipsește.
          </p>
        </div>
      </section>

      {/* De ce nivelul local */}
      <section className="py-16 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-4">
            De ce începem local
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
            Administrația locală e cea mai aproape de tine — și cea mai ușor de influențat.
          </p>
          <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            <p>
              Într-un oraș mediu, câteva mii de voturi pot schimba rezultatul alegerilor. Asta înseamnă că primarul, consiliul local, instituțiile din subordine au un motiv concret să asculte. Dar doar dacă cetățenii cer, urmăresc și nu uită.
            </p>
            <p>
              Majoritatea românilor interacționează zilnic cu administrația locală — taxe, autorizații, servicii publice — dar puțini știu ce informații au dreptul legal să ceară și cum să o facă.
            </p>
            <p>
              Începem de jos în sus. Când administrația locală devine transparentă, presiunea urcă natural spre județ și nivel central.
            </p>
          </div>

          {/* Argumente din alegeri */}
          <div className="mt-8 rounded-xl border border-civic-blue-200 dark:border-blue-700/50 bg-civic-blue-50/50 dark:bg-gray-800 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-600 dark:text-blue-300 mb-3">
              Cât de mult contează fiecare vot la nivel local
            </h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">1.596 <span className="text-base font-normal text-gray-500 dark:text-gray-300">din 3.052</span></div>
                <div className="text-xs font-semibold text-civic-blue-600 dark:text-blue-300">52,3%</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">primari câștigați cu sub 500 de voturi diferență</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">378 <span className="text-base font-normal text-gray-500 dark:text-gray-300">din 3.052</span></div>
                <div className="text-xs font-semibold text-civic-blue-600 dark:text-blue-300">12,4%</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">primari decisi de sub 100 de voturi — mai puțin decât elevii unei școli</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">25 <span className="text-base font-normal text-gray-500 dark:text-gray-300">din 3.052</span></div>
                <div className="text-xs font-semibold text-civic-blue-600 dark:text-blue-300">0,8%</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">localități unde sub 5 voturi au făcut diferența — o singură familie</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              La alegerile locale din iunie 2024, jumătate din primarii României au câștigat cu mai puțin de 500 de voturi. Asta înseamnă că un grup mic de cetățeni activi — care cer socoteală, care pun întrebări, care nu uită — poate influența direct cine conduce comunitatea. Presiunea civică nu e abstractă: într-o comună unde primarul a câștigat la limită, fiecare cerere de informații publice e un semnal că cineva urmărește.
            </p>
            <div className="mt-3">
              <Link
                href="/alegeri-locale-2024"
                className="text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400 hover:underline"
              >
                Vezi analiza completă a alegerilor locale 2024 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ce construim */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-8">
            Ce construim
          </h2>
          <div className="space-y-8">
            {ceConstructim.map((p, i) => (
              <div key={i} className="flex gap-5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-civic-blue-100 dark:bg-civic-blue-900/40 text-civic-blue-600 dark:text-civic-blue-400 flex items-center justify-center text-sm font-bold mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {p.titlu}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-civic-blue-500 dark:bg-civic-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            E gratuit. E simplu. E dreptul tău.
          </h2>
          <p className="text-civic-blue-100 mb-8 max-w-lg mx-auto">
            Creează-ți un cont și trimite prima cerere. Fiecare cerere trimisă e un semnal că cineva urmărește.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3.5 bg-white text-civic-blue-600 font-semibold rounded-md hover:bg-gray-50 transition-colors text-base"
          >
            Începe acum
          </Link>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
