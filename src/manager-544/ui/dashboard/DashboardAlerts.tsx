'use client';

import type { DashboardAlert } from '@m544/shared/types/request';

interface DashboardAlertsProps {
  alerts: DashboardAlert[];
}

/** Enhanced Alerts with Modern Design — renders nothing when there are no alerts. */
export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-8 space-y-3" role="alert" aria-live="polite">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`group relative overflow-hidden p-4 rounded-xl border
                     backdrop-blur-sm transition-all duration-300
                     hover:shadow-lg hover:-translate-y-0.5
                     animate-slide-in
                     ${
            alert.type === 'critical'
              ? 'bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-900/20 dark:to-red-900/5 border-red-200 dark:border-red-800'
              : alert.type === 'warning'
                ? 'bg-gradient-to-r from-orange-50 to-orange-50/50 dark:from-orange-900/20 dark:to-orange-900/5 border-orange-200 dark:border-orange-800'
                : 'bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-900/20 dark:to-blue-900/5 border-blue-200 dark:border-blue-800'
          }`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Accent bar */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 ${
              alert.type === 'critical'
                ? 'bg-red-500'
                : alert.type === 'warning'
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            }`}
            aria-hidden="true"
          />

          <div className="flex items-start gap-3 ml-3">
            {/* Icon with pulse animation for critical */}
            <div
              className={`flex-shrink-0 ${
                alert.type === 'critical' ? 'animate-pulse' : ''
              }`}
            >
              <svg
                className={`h-5 w-5 ${
                  alert.type === 'critical'
                    ? 'text-red-600 dark:text-red-400'
                    : alert.type === 'warning'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-blue-600 dark:text-blue-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>

            <p
              className={`font-medium flex-1 ${
                alert.type === 'critical'
                  ? 'text-red-800 dark:text-red-300'
                  : alert.type === 'warning'
                    ? 'text-orange-800 dark:text-orange-300'
                    : 'text-blue-800 dark:text-blue-300'
              }`}
            >
              {alert.message}
            </p>
          </div>

          {/* Hover glow effect */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100
                       transition-opacity duration-300 pointer-events-none
                       bg-gradient-to-r from-white/20 to-transparent dark:from-white/5"
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}
