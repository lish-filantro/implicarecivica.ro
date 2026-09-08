import Link from "next/link"

/** "Instituții publice" teaser linking to /institutii. */
export function Institutii() {
  return (
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
  )
}
