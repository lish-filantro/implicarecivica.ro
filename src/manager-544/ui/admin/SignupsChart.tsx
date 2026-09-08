interface SignupsChartProps {
  dailySignups: { day: string; count: number }[];
}

/** Daily Signups Chart — one bar per day, hover tooltip with the count. */
export function SignupsChart({ dailySignups }: SignupsChartProps) {
  const maxSignup = Math.max(...dailySignups.map((d) => d.count), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Conturi noi pe zi (ultimele 30 zile)
      </h2>
      <div className="flex items-end gap-[2px] h-32">
        {dailySignups.map((d) => (
          <div
            key={d.day}
            className="flex-1 group relative"
          >
            <div
              className="w-full bg-sky-500 dark:bg-sky-400 rounded-t transition-all hover:bg-sky-600 dark:hover:bg-sky-300"
              style={{
                height: `${Math.max((d.count / maxSignup) * 100, d.count > 0 ? 4 : 0)}%`,
                minHeight: d.count > 0 ? '2px' : '0px',
              }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
              <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap">
                {d.day.slice(5)}: {d.count}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{dailySignups[0]?.day.slice(5)}</span>
        <span>{dailySignups[dailySignups.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}
