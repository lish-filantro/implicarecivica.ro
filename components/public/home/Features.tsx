import Link from "next/link"

export const FEATURES = [
  {
    titlu: 'Cere informații, nu permisiunea',
    desc: 'Asistent care te ghidează să trimiți cereri pe Legea 544/2001. Fără jargon juridic, fără formulare complicate.',
  },
  {
    titlu: 'Urmărește și nu uita',
    desc: 'Manager de cereri cu termene, notificări și istoric. Știi exact cine ți-a răspuns și cine te ignoră.',
  },
  {
    titlu: 'Date deschise din răspunsuri',
    desc: 'Fiecare răspuns devine open data. Analizăm cum performează instituțiile: cine răspunde, cine întârzie, cine refuză.',
  },
  {
    titlu: 'Campanii de presiune civică',
    desc: 'Când o instituție refuză transparența, nu rămâi singur. Cereri coordonate, mai multă vizibilitate, mai greu de ignorat.',
  },
]

/** "De ce începem local" + "Ce construim" sections of the home page. */
export function Features() {
  return (
    <>
      {/* ─── De ce local ─── */}
      <section id="de-ce-local" className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-4">
            De ce începem local
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
            Administrația locală e cea mai aproape de tine — și cea mai ușor de influențat.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Într-un oraș mediu, câteva mii de voturi pot schimba rezultatul alegerilor. Primarul, consiliul local, instituțiile din subordine au un motiv concret să asculte. Dar doar dacă cetățenii cer, urmăresc și nu uită. Începem de jos în sus — când administrația locală devine transparentă, presiunea urcă natural spre județ și nivel central.
          </p>
        </div>
      </section>

      {/* ─── Ce construim ─── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-10 text-center">
            Ce construim
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                  {item.titlu}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/despre"
              className="text-sm text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
            >
              Citește mai mult despre proiect &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
