import type { Institutie } from '@/lib/institutii'

/** "Ce poți cere de la X" — Law 544 use cases as check-marked cards. */
export function CazuriUtilizare({ inst }: { inst: Institutie }) {
  if (inst.cazuri_utilizare_544.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
        Ce poți cere de la {inst.nume_scurt}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {inst.cazuri_utilizare_544.map((caz, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/30 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-civic-blue-500 dark:text-civic-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
              {caz}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
