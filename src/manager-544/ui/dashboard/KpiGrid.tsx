'use client';

import { useMemo } from 'react';
import type { DashboardStats } from '@m544/shared/types/request';
import { KPICard } from './KPICard';
import { buildStatCards } from './kpi-cards';

interface KpiGridProps {
  requestStats: DashboardStats;
  criticalCount: number;
}

export function KpiGrid({ requestStats, criticalCount }: KpiGridProps) {
  // KPI Cards configuration
  const statCards = useMemo(
    () => buildStatCards(requestStats, criticalCount),
    [requestStats, criticalCount],
  );

  return (
    /* KPI Cards with Progressive Loading Animation */
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
  );
}
