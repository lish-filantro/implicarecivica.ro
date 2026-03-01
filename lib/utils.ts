import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate mailcow email from first and last name
 * Format: firstname.lastname@implicarecivica.ro
 */
export function generateMailcowEmail(firstName: string, lastName: string): string {
  const cleanFirstName = firstName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]/g, '');

  const cleanLastName = lastName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]/g, '');

  return `${cleanFirstName}.${cleanLastName}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'implicarecivica.ro'}`;
}

/**
 * Format date to Romanian locale
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'relative') {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Acum';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minut' : 'minute'}`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;

    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }

  if (format === 'long') {
    return d.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  return d.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    received: 'bg-blue-100 text-blue-800',
    extension: 'bg-yellow-100 text-yellow-800',
    answered: 'bg-green-100 text-green-800',
    delayed: 'bg-red-100 text-red-800',
  };

  return colors[status] || colors.pending;
}

/**
 * Get category badge color
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    trimise: 'bg-gray-100 text-gray-800',
    inregistrate: 'bg-green-100 text-green-800',
    amanate: 'bg-yellow-100 text-yellow-800',
    raspunse: 'bg-green-100 text-green-800',
    intarziate: 'bg-red-100 text-red-800',
  };

  return colors[category] || colors.trimise;
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Calculate days until deadline
 */
export function daysUntilDeadline(deadline: Date | string): number {
  const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / 86400000);
}

/**
 * Get deadline urgency level
 */
export function getDeadlineUrgency(deadline: Date | string): 'critical' | 'warning' | 'normal' {
  const days = daysUntilDeadline(deadline);

  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'normal';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
