/**
 * Romanian labels and colour tokens for request statuses.
 */
import type { RequestStatus } from '@m544/shared/types/request';

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Așteaptă nr. înreg.',
  received: 'Înregistrată',
  extension: 'Prelungită',
  answered: 'Răspuns primit',
  delayed: 'Întârziată',
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'blue',
  received: 'emerald',
  extension: 'purple',
  answered: 'green',
  delayed: 'red',
};

export function getStatusLabel(status: RequestStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusColor(status: RequestStatus): string {
  return STATUS_COLORS[status] || 'gray';
}
