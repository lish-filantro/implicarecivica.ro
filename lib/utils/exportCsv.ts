/**
 * CSV Export for Sessions
 * Exports session requests as CSV with UTF-8 BOM for Excel compatibility
 */

import type { RequestSessionWithRequests } from '../types/session';
import type { Request, AnswerSummary } from '../types/request';
import {
  getRequestQuestion,
  getStatusLabel,
  getEffectiveDeadline,
  getDaysUntilDeadline,
} from './requestUtils';

const CSV_HEADERS = [
  'Instituție',
  'Subiect',
  'Întrebare',
  'Status',
  'Nr. înregistrare',
  'Data trimiterii',
  'Data primirii',
  'Termen limită',
  'Zile rămase',
  'Răspuns',
];

function escapeCsvField(value: string): string {
  if (!value) return '';
  // Wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

function flattenAnswer(answer: AnswerSummary | undefined | null): string {
  if (!answer) return '';

  if (typeof answer === 'string') return answer;

  switch (answer.type) {
    case 'text':
      return answer.content;
    case 'list':
      return answer.content.join('; ');
    case 'table':
      return answer.rows.map(row => row.join(' | ')).join('; ');
    default:
      return '';
  }
}

function requestToRow(request: Request): string {
  const deadline = getEffectiveDeadline(request);
  const daysLeft = getDaysUntilDeadline(deadline);

  const fields = [
    request.institution_name || '',
    request.subject || '',
    getRequestQuestion(request),
    getStatusLabel(request.status),
    request.registration_number || '',
    formatDate(request.date_sent),
    formatDate(request.date_received || request.response_received_date),
    formatDate(deadline),
    daysLeft !== null ? String(daysLeft) : '',
    flattenAnswer(request.answer_summary),
  ];

  return fields.map(escapeCsvField).join(',');
}

export function exportSessionToCsv(session: RequestSessionWithRequests): void {
  const headerLine = CSV_HEADERS.map(escapeCsvField).join(',');
  const dataLines = session.requests.map(requestToRow);
  const csvContent = [headerLine, ...dataLines].join('\r\n');

  // UTF-8 BOM for Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const safeName = session.institution_name
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `sesiune-${safeName}-${date}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
