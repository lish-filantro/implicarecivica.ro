/**
 * CSV export of a session's requests. `sessionToCsv` is pure (BOM + CRLF rows,
 * Excel-friendly); `exportSessionToCsv` triggers the browser download.
 */
import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import type { Request, AnswerSummary } from '@m544/shared/types/request';
import { getRequestQuestion } from './utils/question-extraction';
import { getStatusLabel } from './utils/labels';
import { getEffectiveDeadline, getDaysUntilDeadline } from './utils/deadlines';

export const CSV_HEADERS = [
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

const BOM = '\uFEFF';

function escapeCsvField(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      return answer.rows.map((row) => row.join(' | ')).join('; ');
    default:
      return '';
  }
}

function requestToRow(request: Request, now: Date): string {
  const deadline = getEffectiveDeadline(request);
  const daysLeft = getDaysUntilDeadline(deadline, now);
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

/** The full CSV text, UTF-8 BOM included. */
export function sessionToCsv(session: RequestSessionWithRequests, now: Date = new Date()): string {
  const headerLine = CSV_HEADERS.map(escapeCsvField).join(',');
  const dataLines = session.requests.map((r) => requestToRow(r, now));
  return BOM + [headerLine, ...dataLines].join('\r\n');
}

/** sesiune-<institution slug, max 40>-<yyyy-mm-dd>.csv */
export function csvFilename(session: RequestSessionWithRequests, now: Date = new Date()): string {
  const safeName = session.institution_name
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  return `sesiune-${safeName}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Browser only: build the CSV and trigger a download. */
export function exportSessionToCsv(session: RequestSessionWithRequests): void {
  const now = new Date();
  const blob = new Blob([sessionToCsv(session, now)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFilename(session, now);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
