import Link from 'next/link'
import Image from 'next/image'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

const piloni = [
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
    desc: 'Fiecare răspuns primit devine o bucată de open data. Analizăm cum performează instituțiile: cine răspunde, cine ignoră, cine întârzie.',
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
              className="text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400"
            >
              Despre
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors"
            >
              Autentificare
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Administrația lucrează pentru tine.
            <br />
            <span className="text-civic-blue-500 dark:text-civic-blue-400">Noi te ajutăm să o verifici.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Implicare Civică este o platformă care pune la dispoziția cetățenilor uneltele necesare pentru a înțelege, interoga și responsabiliza instituțiile publice din România.
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
        </div>
      </section>

      {/* Ce construim */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-8">
            Ce construim
          </h2>
          <div className="space-y-8">
            {piloni.map((p, i) => (
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
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Platforma e în construcție.
            <br />
            Mișcarea a început deja.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto">
            Creează-ți un cont și trimite prima cerere. Fiecare cerere trimisă e un semnal că cineva urmărește.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-base"
          >
            Începe acum
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-400 dark:text-gray-500">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            implicarecivica.ro
          </Link>
          {' '}&mdash; Platformă în versiune beta
        </div>
      </footer>
    </div>
  )
}
