'use client';

import Link from "next/link"
import Image from "next/image"
import { PublicNavbar } from "@/components/shared/PublicNavbar"
import { PublicFooter } from "@/components/shared/PublicFooter"

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* ─── Nav ─── */}
      <PublicNavbar />

      {/* ─── Hero ─── */}
      <section className="relative pt-28 pb-24 px-6 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-civic-blue-100/30 dark:bg-civic-blue-900/10 blur-3xl" />
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes hero-fade-up {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes highlight-draw {
            from { background-size: 0% 40%; }
            to   { background-size: 100% 40%; }
          }
          .hero-stagger { opacity: 0; animation: hero-fade-up 0.7s ease-out forwards; }
          .hero-delay-1 { animation-delay: 0.1s; }
          .hero-delay-2 { animation-delay: 0.3s; }
          .hero-delay-3 { animation-delay: 0.5s; }
          .hero-delay-4 { animation-delay: 0.7s; }
          .hero-delay-5 { animation-delay: 0.9s; }
          .hero-highlight {
            background-image: linear-gradient(120deg, #ff660040 0%, #ff660040 100%);
            background-repeat: no-repeat;
            background-position: 0 85%;
            background-size: 0% 40%;
            animation: highlight-draw 0.8s ease-out forwards;
            animation-delay: 0.9s;
          }
          @media (prefers-color-scheme: dark) {
            .hero-highlight {
              background-image: linear-gradient(120deg, #ff660030 0%, #ff660030 100%);
            }
          }
        `}</style>

        <div className="max-w-4xl mx-auto text-center">
          <Image
            src="/assets/implicare_civica_logo.png"
            alt="Implicare Civică"
            width={450}
            height={450}
            className="hero-stagger hero-delay-1 mx-auto mb-10 w-80 md:w-[400px] h-auto drop-shadow-lg"
            priority
          />
          <h1 className="hero-stagger hero-delay-2 text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight">
            <span className="hero-highlight text-activist-orange-600 dark:text-activist-orange-400">Administrația publică</span> trebuie
            <br />
            să lucreze pentru <span className="hero-highlight text-activist-orange-600 dark:text-activist-orange-400">cetățeni</span>.
          </h1>
          <p className="hero-stagger hero-delay-3 mt-4 text-2xl md:text-3xl font-semibold text-civic-blue-500 dark:text-civic-blue-400 tracking-tight">
            Noi te ajutăm să o verifici.
          </p>
          <p className="hero-stagger hero-delay-4 mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
            Unelte civice pentru a <strong className="text-gray-700 dark:text-gray-200">înțelege</strong>, <strong className="text-gray-700 dark:text-gray-200">interoga</strong> și <strong className="text-gray-700 dark:text-gray-200">responsabiliza</strong> instituțiile publice din România. Începând de la administrația locală.
          </p>
          <div className="hero-stagger hero-delay-5 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 shadow-lg shadow-civic-blue-500/25 hover:shadow-civic-blue-500/40 transition-all text-base"
            >
              Trimite prima cerere
            </Link>
            <a
              href="#de-ce-local"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm"
            >
              Află mai multe &darr;
            </a>
          </div>
        </div>
      </section>

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
            {[
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
            ].map((item, i) => (
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

      {/* ─── Cum funcționează ─── */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-12 text-center">
            Cum funcționează
          </h2>
          <div className="space-y-10">
            {[
              {
                step: "1",
                title: "Descrii ce informație vrei",
                desc: "Asistentul te ajută să formulezi corect cererea, conform Legii 544/2001.",
              },
              {
                step: "2",
                title: "Trimiți cererea",
                desc: "Direct către instituția publică, din platformă. Fără să cauți adrese sau să scrii de la zero.",
              },
              {
                step: "3",
                title: "Urmărești răspunsul",
                desc: "Primești notificări și știi exact când expiră termenul legal de 30 de zile.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-civic-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Instituții ─── */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-4">
            Instituții publice
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
            Află ce informații poți cere pe Legea 544 de la peste 60 de tipuri de instituții din România.
          </p>
          <Link
            href="/institutii"
            className="inline-block px-6 py-3 border border-civic-blue-500 text-civic-blue-600 dark:text-civic-blue-400 font-semibold rounded-md hover:bg-civic-blue-50 dark:hover:bg-civic-blue-900/20 transition-colors text-sm"
          >
            Explorează instituțiile &rarr;
          </Link>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="py-24 px-6 bg-civic-blue-500 dark:bg-civic-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            E gratuit. E simplu. E dreptul tău.
          </h2>
          <p className="mt-4 text-civic-blue-100 max-w-lg mx-auto">
            Creează-ți un cont și trimite prima cerere. Fiecare cerere trimisă e un semnal că cineva urmărește.
          </p>
          <div className="mt-8">
            <Link
              href="/register"
              className="inline-block px-8 py-3.5 bg-white text-civic-blue-600 font-semibold rounded-md hover:bg-gray-50 transition-colors text-base"
            >
              Începe acum
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <PublicFooter />
    </div>
  )
}
