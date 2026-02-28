/**
 * KPICard Component
 * Displays a key performance indicator with gradient styling
 * Used for dashboard statistics (total requests, registered, answered, etc.)
 */

'use client';

import { ReactNode } from 'react';

interface KPICardProps {
  id: string;
  title: string;
  value: number;
  subtitle?: string;
  icon: ReactNode;
  iconWrapperLight: string;
  iconWrapperDark: string;
  valueGradientLight: string;
  valueGradientDark: string;
  backgroundLight: string;
  backgroundDark: string;
  onClick?: () => void;
}

export function KPICard({
  id,
  title,
  value,
  subtitle,
  icon,
  iconWrapperLight,
  iconWrapperDark,
  valueGradientLight,
  valueGradientDark,
  backgroundLight,
  backgroundDark,
  onClick,
}: KPICardProps) {
  const isClickable = Boolean(onClick);

  const baseClasses = `
    group relative overflow-hidden rounded-3xl border border-slate-200/80
    bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm
    transition-all duration-300
    dark:border-white/10 dark:bg-slate-900/40 dark:shadow-slate-900/25
    h-full min-h-[160px]
  `;

  const hoverClasses = isClickable
    ? 'hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl cursor-pointer'
    : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Background gradient */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${backgroundLight} ${backgroundDark} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          {/* Title */}
          <p className="min-h-[48px] text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 flex items-center">
            {title}
          </p>

          {/* Value */}
          <div className="flex items-baseline gap-3">
            <span
              className={`text-4xl font-bold tracking-tight bg-gradient-to-r ${valueGradientLight} ${valueGradientDark} text-transparent bg-clip-text`}
            >
              {value}
            </span>
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {/* Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center !rounded-2xl border ${iconWrapperLight} ${iconWrapperDark}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
