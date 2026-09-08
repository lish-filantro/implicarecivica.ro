import type { Institutie } from '@/lib/institutii'

/** "Ce face această instituție" — the full attribution list (shown when there is more than the lead one). */
export function Atributii({ inst }: { inst: Institutie }) {
  if (inst.atributii_principale.length <= 1) return null
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
        Ce face această instituție
      </h2>
      <ul className="space-y-2.5">
        {inst.atributii_principale.map((attr, i) => (
          <li
            key={i}
            className="flex gap-3 text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed"
          >
            <span className="flex-shrink-0 text-gray-300 dark:text-gray-600 mt-0.5">
              &bull;
            </span>
            {attr}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Dacă nu primești răspuns" — the complaint path from procedura_544.contestatii. */
export function Contestatii({ inst }: { inst: Institutie }) {
  const text = inst.procedura_544?.contestatii
  if (!text) return null
  return (
    <section className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 p-5">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
        Dacă nu primești răspuns
      </h3>
      <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
        {text}
      </p>
    </section>
  )
}
