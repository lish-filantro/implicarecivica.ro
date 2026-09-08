import type { ProcessingStatus } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';

/** 'list' = compact badge in EmailList; 'detail' = badge in the EmailDetail header. */
export type BadgeVariant = 'list' | 'detail';

export const CATEGORY_LABELS: Record<EmailCategory, { label: string; className: string }> = {
  trimise: { label: 'Trimis', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  inregistrate: {
    label: 'Înregistrat',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  amanate: { label: 'Amânat', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  raspunse: {
    label: 'Răspuns',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  intarziate: { label: 'Întârziat', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  redirectionat: {
    label: 'Redirecționat',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  irelevant: { label: 'Irelevant', className: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

/** Longer labels used in the detail header. */
export const CATEGORY_DETAIL_LABELS: Record<EmailCategory, string> = {
  trimise: 'Trimis',
  inregistrate: 'Confirmare înregistrare',
  amanate: 'Cerere de prelungire',
  raspunse: 'Răspuns final',
  intarziate: 'Răspuns întârziat',
  redirectionat: 'Redirecționat',
  irelevant: 'Irelevant',
};

const PROCESSING_CONFIG: Record<Exclude<ProcessingStatus, 'completed'>, { label: string; detailLabel: string; className: string }> = {
  pending: {
    label: 'Neprocesar',
    detailLabel: 'Neprocesar',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
  processing: {
    label: 'Se procesează...',
    detailLabel: 'Se procesează...',
    className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 animate-pulse',
  },
  failed: {
    label: 'Eșuat',
    detailLabel: 'Procesare eșuată',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

const SIZE_CLASS: Record<BadgeVariant, string> = {
  list: 'text-[10px] px-1.5 py-0.5 rounded-full',
  detail: 'text-xs px-2 py-0.5 rounded-full',
};

export function CategoryBadge({ category, variant = 'list' }: { category: EmailCategory; variant?: BadgeVariant }) {
  const c = CATEGORY_LABELS[category];
  if (!c) return null;
  const label = variant === 'detail' ? CATEGORY_DETAIL_LABELS[category] : c.label;
  return <span className={`${SIZE_CLASS[variant]} font-medium ${c.className}`}>{label}</span>;
}

export function ProcessingBadge({ status, variant = 'list' }: { status: ProcessingStatus; variant?: BadgeVariant }) {
  if (status === 'completed') return null;
  const c = PROCESSING_CONFIG[status];
  if (!c) return null;
  const label = variant === 'detail' ? c.detailLabel : c.label;
  return <span className={`${SIZE_CLASS[variant]} ${c.className}`}>{label}</span>;
}
