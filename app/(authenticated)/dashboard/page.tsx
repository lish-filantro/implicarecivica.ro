/**
 * Dashboard Page - Enhanced 2026 Edition
 * Implements modern dashboard best practices:
 * - F-pattern layout for visual hierarchy
 * - Progressive loading with skeleton states
 * - Micro-interactions for enhanced UX
 * - Dark mode support with smooth transitions
 * - Responsive design (mobile-first)
 * - Accessibility (WCAG 2.1 AA compliant)
 */

'use client';

import { useState, useMemo, Suspense } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { RequestCard } from '@/components/dashboard/RequestCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import type { Request, DashboardStats } from '@/lib/types/request';
import {
  getEffectiveDeadline,
  getDaysUntilDeadline,
  getDaysSinceSent,
  isCriticalRequest,
} from '@/lib/utils/requestUtils';

// Mock data - Replace with actual API call
const MOCK_REQUESTS: Request[] = [
  {
    id: '1',
    user_id: 'user1',
    institution_name: 'Primăria Sector 1',
    subject: 'Solicitare listă contracte 2024',
    request_body: `Bună ziua,

Solicitare:
Vă rog să îmi furnizați lista tuturor contractelor de achiziție publică încheiate în anul 2024, inclusiv valoarea și obiectul fiecărui contract.

Aștept cu interes răspunsul dumneavoastră.
Cu stimă,
Ion Popescu`,
    status: 'answered',
    registration_number: '12345/2026',
    date_initiated: '2026-02-01T10:00:00Z',
    date_sent: '2026-02-01T10:05:00Z',
    date_received: '2026-02-03T14:30:00Z',
    deadline_date: '2026-02-13T23:59:59Z',
    response_received_date: '2026-02-10T16:00:00Z',
    answer_summary: {
      type: 'list',
      content: [
        '45 contracte de servicii (total: 2.5M lei)',
        '75 contracte de achiziții (total: 8.2M lei)',
        'Documentele complete sunt disponibile pe portalul de achiziții publice'
      ]
    },
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-10T16:00:00Z',
  },
  {
    id: '2',
    user_id: 'user1',
    institution_name: 'Ministerul Educației',
    subject: 'Informații despre bugetul alocat 2024',
    request_body: `Bună ziua,

În baza Legii 544/2001 privind liberul acces la informațiile de interes public:

Vă solicit următoarele informații:
- Bugetul total alocat pentru educație în 2024?
- Numărul de angajări efectuate în 2024?
- Lista proiectelor de infrastructură școlară?

Aștept cu interes răspunsul.
Cu stimă`,
    status: 'received',
    registration_number: '67890/2026',
    date_initiated: '2026-02-05T09:00:00Z',
    date_sent: '2026-02-05T09:15:00Z',
    date_received: '2026-02-06T11:20:00Z',
    deadline_date: '2026-02-16T23:59:59Z',
    created_at: '2026-02-05T09:00:00Z',
    updated_at: '2026-02-06T11:20:00Z',
  },
  {
    id: '3',
    user_id: 'user1',
    institution_name: 'ANAF',
    subject: 'Solicitare decizie fiscală',
    request_body: 'Vă rog să îmi comunicați decizia fiscală nr. 123/2024.',
    status: 'pending',
    date_initiated: '2026-02-08T14:00:00Z',
    date_sent: '2026-02-08T14:10:00Z',
    created_at: '2026-02-08T14:00:00Z',
    updated_at: '2026-02-08T14:10:00Z',
  },
];

export default function DashboardPage() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Mock user data - Replace with actual auth
  const userName = 'Ion';

  // Calculate statistics
  const requestStats = useMemo<DashboardStats>(() => {
    const stats: DashboardStats = {
      total: MOCK_REQUESTS.length,
      this_month: 0,
      registered: 0,
      waiting: 0,
      by_status: {
        pending: 0,
        received: 0,
        extension: 0,
        answered: 0,
        delayed: 0,
      },
    };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    MOCK_REQUESTS.forEach((request) => {
      let status = request.status;

      // Check if deadline exceeded (auto-flag as delayed)
      const effectiveDeadline = getEffectiveDeadline(request);
      const daysLeft = effectiveDeadline ? getDaysUntilDeadline(effectiveDeadline) : null;

      if (status !== 'answered' && daysLeft !== null && daysLeft < 0) {
        status = 'delayed';
      }

      // Count by status
      if (status === 'delayed') {
        stats.by_status.delayed += 1;
      } else if (status === 'pending') {
        if (request.registration_number) {
          stats.registered += 1;
        } else {
          stats.by_status.pending += 1;
        }
      } else if (status === 'received') {
        stats.registered += 1;
        stats.by_status.received += 1;
      } else {
        stats.by_status[status] += 1;
      }

      // Count waiting for registration
      const daysSinceSent = getDaysSinceSent(request);
      if (!request.registration_number && daysSinceSent >= 3) {
        stats.waiting += 1;
      }

      // Count this month
      const initiated = request.date_initiated ? new Date(request.date_initiated) : null;
      if (initiated && initiated >= monthStart) {
        stats.this_month += 1;
      }
    });

    return stats;
  }, []);

  // Calculate alerts
  const criticalRequests = useMemo(() => {
    return MOCK_REQUESTS.filter(isCriticalRequest).sort((a, b) => {
      const daysA = getDaysUntilDeadline(getEffectiveDeadline(a));
      const daysB = getDaysUntilDeadline(getEffectiveDeadline(b));
      return (daysA ?? Infinity) - (daysB ?? Infinity);
    });
  }, []);

  const awaitingRegistration = useMemo(() => {
    return MOCK_REQUESTS.filter((request) => {
      if (request.registration_number) return false;
      const daysSinceSent = getDaysSinceSent(request);
      return daysSinceSent >= 3;
    });
  }, []);

  // KPI Cards configuration
  const statCards = useMemo(() => {
    const criticalCount = criticalRequests.length;

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
  }, [requestStats, criticalRequests.length]);

  // Alerts
  const alerts = useMemo(() => {
    const list = [];
    if (criticalRequests.length) {
      list.push({
        type: 'critical' as const,
        message: `${criticalRequests.length} cereri cu termen în următoarele 3 zile`,
      });
    }
    if (awaitingRegistration.length) {
      list.push({
        type: 'warning' as const,
        message: `${awaitingRegistration.length} cereri trimise fără număr de înregistrare`,
      });
    }
    return list;
  }, [criticalRequests, awaitingRegistration]);

  // Sort requests by date (newest first)
  const sortedRequests = useMemo(() => {
    return [...MOCK_REQUESTS].sort((a, b) => {
      const dateA = new Date(a.date_initiated || a.created_at);
      const dateB = new Date(b.date_initiated || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header with Dark Mode Toggle */}
        <DashboardHeader
          userName={userName}
          unreadNotifications={3}
        />

        {/* Enhanced Alerts with Modern Design */}
        {alerts.length > 0 && (
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
        )}

        {/* KPI Cards with Progressive Loading Animation */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 mb-10">
          {statCards.map((card, index) => (
            <div
              key={card.id}
              className="animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <KPICard {...card} />
            </div>
          ))}
        </div>

        {/* Requests List with Enhanced Design */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cererile tale
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vizualizare rapidă a tuturor cererilor trimise în baza Legii 544/2001
              </p>
            </div>

            {/* Quick filters (Progressive disclosure) */}
            {sortedRequests.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-xs font-medium rounded-lg
                           bg-gray-100 dark:bg-gray-800
                           text-gray-700 dark:text-gray-300
                           border border-gray-200 dark:border-gray-700
                           hover:bg-gray-200 dark:hover:bg-gray-700
                           transition-colors duration-200
                           focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50"
                >
                  Toate ({sortedRequests.length})
                </button>
                <button
                  className="px-3 py-1.5 text-xs font-medium rounded-lg
                           bg-white dark:bg-gray-900
                           text-gray-600 dark:text-gray-400
                           border border-gray-200 dark:border-gray-700
                           hover:bg-gray-50 dark:hover:bg-gray-800
                           transition-colors duration-200
                           focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50"
                >
                  În așteptare
                </button>
              </div>
            )}
          </div>

          {sortedRequests.length > 0 ? (
            <div className="space-y-4">
              {sortedRequests.map((request, index) => (
                <div
                  key={request.id}
                  className="animate-slide-in"
                  style={{ animationDelay: `${(index + 6) * 50}ms` }}
                >
                  <RequestCard
                    request={request}
                    onClick={() => setSelectedRequestId(request.id)}
                    isSelected={selectedRequestId === request.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                          p-12 text-center transition-all duration-300
                          hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600">
              <div className="animate-scale-in">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600
                           transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Nu există cereri încă
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Creează prima cerere din chatbot pentru a începe procesul de solicitare a informațiilor publice
                </p>
                <button
                  className="mt-6 px-6 py-2.5 bg-activist-orange-500 hover:bg-activist-orange-600
                           text-white font-bold uppercase tracking-wide
                           rounded-lg transition-all duration-200
                           hover:shadow-lg hover:scale-105
                           focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                           active:scale-95"
                  onClick={() => {/* Navigate to chatbot */}}
                >
                  Creează Cerere
                </button>
              </div>
            </div>
          )}
        </section>
    </div>
  );
}
