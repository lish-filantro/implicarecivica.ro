export const STEPS = [
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
    desc: "Primești notificări și știi exact când expiră termenul legal de 10 zile lucrătoare.",
  },
]

/** "Cum funcționează" — the three steps of the home page. */
export function HowItWorks() {
  return (
    <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-civic-blue-500 dark:text-civic-blue-400 mb-12 text-center">
          Cum funcționează
        </h2>
        <div className="space-y-10">
          {STEPS.map((item) => (
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
  )
}
