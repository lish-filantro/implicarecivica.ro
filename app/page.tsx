'use client';

import Link from "next/link"
import { DarkModeToggle } from "@/components/shared/DarkModeToggle"

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-activist text-lg tracking-tight text-civic-blue-700 dark:text-civic-blue-400">
            implicarecivica.ro
          </span>
          <div className="flex items-center gap-3">
<DarkModeToggle />
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

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
            Informația publică e dreptul tău.
            <br />
            <span className="text-civic-blue-500 dark:text-civic-blue-400">Noi te ajutăm să o ceri.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Un instrument simplu pentru a trimite cereri pe Legea 544/2001 și a urmări ce se întâmplă cu ele.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-base"
            >
              Trimite prima cerere
            </Link>
            <a
              href="#problema"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm"
            >
              Află mai multe &darr;
            </a>
          </div>
        </div>
      </section>

      {/* ─── Problema ─── */}
      <section id="problema" className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-4">
            Problema
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
            Legea 544/2001 îți dă dreptul să ceri orice informație de interes public de la orice instituție din România.
            Problema e că puțini știu cum s-o formuleze corect, iar și mai puțini știu ce să facă dacă nu primesc răspuns în termen.
          </p>
        </div>
      </section>

      {/* ─── Ce facem ─── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-10 text-center">
            Ce facem
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-civic-blue-200 dark:hover:border-civic-blue-700 hover:shadow-md dark:hover:shadow-civic-blue-900/20 transition-all">
              <div className="w-12 h-12 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/30 flex items-center justify-center mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-civic-blue-500 dark:text-civic-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Asistent cereri 544
              </h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Un chatbot care te ghidează pas cu pas să formulezi o cerere corectă, completă și cu șanse reale de răspuns.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-civic-blue-200 dark:hover:border-civic-blue-700 hover:shadow-md dark:hover:shadow-civic-blue-900/20 transition-all">
              <div className="w-12 h-12 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/30 flex items-center justify-center mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-civic-blue-500 dark:text-civic-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Manager cereri
              </h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Urmărești starea fiecărei cereri: înregistrată, în termen, întârziată, răspunsă. Tot istoricul tău, într-un loc.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Cum funcționează ─── */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-12 text-center">
            Cum funcționează
          </h2>
          <div className="space-y-10">
            {[
              {
                step: "1",
                title: "Descrii ce informație vrei",
                desc: "Chatbotul te ajută să formulezi corect cererea, conform Legii 544/2001.",
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


      {/* ─── De ce contează ─── */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-6">
            De ce contează
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
            Administrațiile locale funcționează mai bine când sunt urmărite.
            Fiecare cerere trimisă e un act mic de transparență.
            Împreună, ele contează.
          </p>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="py-24 px-6 bg-civic-blue-500 dark:bg-civic-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            E gratuit. E simplu. E dreptul tău.
          </h2>
          <div className="mt-8">
            <Link
              href="/register"
              className="inline-block px-8 py-3.5 bg-white text-civic-blue-600 font-semibold rounded-md hover:bg-gray-50 transition-colors text-base"
            >
              Începe acum
            </Link>
          </div>
          <p className="mt-4 text-civic-blue-200 text-sm">
            Platformă în versiune beta &mdash; construim împreună
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-6">
            <span className="font-activist text-gray-500 dark:text-gray-400 tracking-tight">implicarecivica.ro</span>
            <a href="mailto:contact@implicarecivica.ro" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              contact@implicarecivica.ro
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span>Versiune beta</span>
            <span className="text-gray-200 dark:text-gray-700">|</span>
            <span>2026</span>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4">
          <p className="text-xs text-gray-300 dark:text-gray-600 text-center">
            Nu suntem avocați. Platforma facilitează exercitarea unui drept legal existent.
          </p>
        </div>
      </footer>
    </div>
  )
}
