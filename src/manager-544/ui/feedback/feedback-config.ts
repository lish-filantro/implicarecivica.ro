import type { FeedbackCategory, FeedbackStatus } from '@m544/shared/types/feedback';

export const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'sugestie', label: 'Sugestie' },
  { value: 'utilizare', label: 'Dificultate' },
  { value: 'altele', label: 'Altele' },
];

export const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; className: string }> = {
  bug: {
    label: 'Bug',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  sugestie: {
    label: 'Sugestie',
    className: 'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/30 dark:text-civic-blue-300',
  },
  utilizare: {
    label: 'Dificultate',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  altele: {
    label: 'Altele',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
};

export const STATUS_CONFIG: Record<FeedbackStatus, { label: string; className: string }> = {
  nou: {
    label: 'Nou',
    className: 'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/30 dark:text-civic-blue-300',
  },
  in_lucru: {
    label: 'În lucru',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  rezolvat: {
    label: 'Rezolvat',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  respins: {
    label: 'Respins',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};
