import { StatusRow } from './StatusRow';
import { STATUS_LABELS } from './types';

interface StatusDistributionProps {
  title: string;
  distribution: Record<string, number>;
  /** Shown when the distribution is empty (e.g. "Nicio cerere"). */
  emptyLabel: string;
}

/** One card with a bar per status (requests or feedback). */
export function StatusDistribution({ title, distribution, emptyLabel }: StatusDistributionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        {title}
      </h2>
      <div className="space-y-3">
        {Object.entries(distribution).map(([status, count]) => (
          <StatusRow
            key={status}
            label={STATUS_LABELS[status] || status}
            count={count}
            total={Object.values(distribution).reduce((a, b) => a + b, 0)}
          />
        ))}
        {Object.keys(distribution).length === 0 && (
          <p className="text-sm text-gray-400">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
