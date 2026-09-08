/**
 * The six KPI cards of the dashboard: labels, colour tokens and icons, built
 * from the request stats. Pure — no hooks.
 */
import type { DashboardStats } from '@m544/shared/types/request';
import type { KPICardProps } from './KPICard';

export function buildStatCards(requestStats: DashboardStats, criticalCount: number): KPICardProps[] {
  return [
    {
      id: 'total',
      title: 'Total cereri',
      value: requestStats.total,
      subtitle: `Luna aceasta: ${requestStats.this_month}`,
      iconWrapperLight: 'border-sky-200 bg-sky-50 text-sky-700',
      iconWrapperDark: 'dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200',
      valueGradientLight: 'from-sky-500 via-sky-600 to-blue-700',
      valueGradientDark: 'dark:from-sky-200 dark:via-sky-300 dark:to-sky-500',
      backgroundLight: 'from-sky-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-sky-500/15 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'pending',
      title: 'Așteptare înregistrare',
      value: requestStats.by_status.pending,
      subtitle: 'În așteptarea unui număr de înregistrare',
      iconWrapperLight: 'border-amber-200 bg-amber-50 text-amber-700',
      iconWrapperDark: 'dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
      valueGradientLight: 'from-amber-500 via-orange-500 to-orange-600',
      valueGradientDark: 'dark:from-amber-200 dark:via-amber-300 dark:to-orange-500',
      backgroundLight: 'from-amber-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-amber-500/10 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'registered',
      title: 'Înregistrate',
      value: requestStats.registered,
      subtitle: 'Înregistrate și în așteptarea răspunsului',
      iconWrapperLight: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      iconWrapperDark: 'dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200',
      valueGradientLight: 'from-indigo-500 via-indigo-600 to-blue-700',
      valueGradientDark: 'dark:from-blue-200 dark:via-blue-300 dark:to-indigo-500',
      backgroundLight: 'from-indigo-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-blue-500/10 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'answered',
      title: 'Răspunse',
      value: requestStats.by_status.answered,
      subtitle: 'Finalizate cu succes',
      iconWrapperLight: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      iconWrapperDark: 'dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
      valueGradientLight: 'from-emerald-500 via-emerald-600 to-emerald-700',
      valueGradientDark: 'dark:from-emerald-200 dark:via-emerald-300 dark:to-emerald-500',
      backgroundLight: 'from-emerald-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-emerald-500/10 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'extension',
      title: 'Prelungite',
      value: requestStats.by_status.extension,
      subtitle: 'Cereri cu termen extins',
      iconWrapperLight: 'border-purple-200 bg-purple-50 text-purple-700',
      iconWrapperDark: 'dark:border-purple-400/40 dark:bg-purple-500/10 dark:text-purple-200',
      valueGradientLight: 'from-purple-500 via-purple-600 to-violet-700',
      valueGradientDark: 'dark:from-purple-200 dark:via-purple-300 dark:to-violet-500',
      backgroundLight: 'from-purple-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-purple-500/10 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'delayed',
      title: 'Întârziate',
      value: requestStats.by_status.delayed,
      subtitle:
        criticalCount > 0
          ? `${criticalCount} termene în următoarele 3 zile`
          : 'Termene depășite fără răspuns',
      iconWrapperLight: 'border-rose-200 bg-rose-50 text-rose-700',
      iconWrapperDark: 'dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200',
      valueGradientLight: 'from-rose-500 via-rose-600 to-rose-700',
      valueGradientDark: 'dark:from-rose-200 dark:via-rose-300 dark:to-rose-500',
      backgroundLight: 'from-rose-500/10 via-white/0 to-transparent',
      backgroundDark: 'dark:from-rose-500/10 dark:via-transparent dark:to-transparent',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 5a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z" />
        </svg>
      ),
    },
  ];
}
