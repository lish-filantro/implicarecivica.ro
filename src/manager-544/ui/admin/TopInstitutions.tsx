interface TopInstitutionsProps {
  institutions: { name: string; total: number; answered: number }[];
}

/** Top Institutions — table with totals and a colour-coded answer rate. */
export function TopInstitutions({ institutions }: TopInstitutionsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Top instituții solicitate
      </h2>
      {institutions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Instituție</th>
                <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Total cereri</th>
                <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Răspunse</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Rată răspuns</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst, i) => {
                const rate = inst.total > 0 ? Math.round((inst.answered / inst.total) * 100) : 0;
                return (
                  <tr
                    key={inst.name}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium">
                      {inst.name}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {inst.total}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {inst.answered}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          rate >= 75
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : rate >= 40
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        }`}
                      >
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Nicio cerere trimisă</p>
      )}
    </div>
  );
}
