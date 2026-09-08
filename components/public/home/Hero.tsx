import Link from "next/link"
import Image from "next/image"

/** Home page hero: logo, headline, primary CTA. Includes its own keyframes. */
export function Hero() {
  return (
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
          .dark .hero-highlight {
            background-image: linear-gradient(120deg, #ff660030 0%, #ff660030 100%);
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
  )
}
