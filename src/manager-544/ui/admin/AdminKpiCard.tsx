export function AdminKpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    sky: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20',
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    rose: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20',
  };

  const valueColorMap: Record<string, string> = {
    sky: 'text-sky-700 dark:text-sky-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    amber: 'text-amber-700 dark:text-amber-300',
    rose: 'text-rose-700 dark:text-rose-300',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.sky}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </p>
      <p className={`text-3xl font-bold mt-2 ${valueColorMap[color] || valueColorMap.sky}`}>
        {value.toLocaleString('ro-RO')}
      </p>
    </div>
  );
}
