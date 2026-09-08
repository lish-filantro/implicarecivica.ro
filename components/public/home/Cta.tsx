import Link from "next/link"

/** Final call to action of the home page. */
export function Cta() {
  return (
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
  )
}
