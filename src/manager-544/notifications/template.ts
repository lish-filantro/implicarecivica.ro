/**
 * The daily deadline digest email (Romanian): subject with correct plural
 * forms, an HTML table (institution, subject, deadline, days left) and a plain
 * text twin. Every user-provided string is escaped before it reaches the HTML.
 */
import { getEffectiveDeadline } from '@m544/requests/utils/deadlines';
import type { DeadlineNotice } from './select';

export interface DigestContext {
  /** Base URL of the app, e.g. https://implicarecivica.ro (the link target is `${appUrl}/dashboard`). */
  appUrl: string;
  displayName: string | null;
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** "1 cerere", "3 cereri", "20 de cereri". */
function cereri(n: number): string {
  if (n === 1) return '1 cerere';
  return n < 20 ? `${n} cereri` : `${n} de cereri`;
}

export function digestSubject(upcoming: number, overdue: number, host: string): string {
  const parts: string[] = [];
  if (upcoming > 0) parts.push(`${cereri(upcoming)} cu termen apropiat`);
  if (overdue > 0) {
    const adj = overdue === 1 ? 'depășită' : 'depășite';
    parts.push(upcoming > 0 ? `${overdue} ${adj}` : `${cereri(overdue)} ${adj}`);
  }
  return `${parts.join(', ')} – ${host}`;
}

const dateFormat = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

function formatDeadline(notice: DeadlineNotice): string {
  const iso = getEffectiveDeadline(notice.request);
  return iso ? dateFormat.format(new Date(iso)) : '–';
}

export function daysText(notice: DeadlineNotice): string {
  const d = notice.daysLeft;
  if (notice.kind === 'overdue') {
    if (d >= 0) return 'depășit';
    const n = -d;
    return n === 1 ? 'depășit cu 1 zi' : `depășit cu ${n} zile`;
  }
  if (d === 0) return 'astăzi';
  return d === 1 ? '1 zi rămasă' : `${d} zile rămase`;
}

function hostOf(appUrl: string): string {
  try {
    return new URL(appUrl).hostname;
  } catch {
    return 'implicarecivica.ro';
  }
}

const CELL = 'padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:14px;';

function row(notice: DeadlineNotice): string {
  const color = notice.kind === 'overdue' ? '#b91c1c' : notice.daysLeft <= 1 ? '#c2410c' : '#1f2937';
  return (
    `<tr class="notice ${notice.kind}">` +
    `<td style="${CELL}">${escapeHtml(notice.request.institution_name)}</td>` +
    `<td style="${CELL}">${escapeHtml(notice.request.subject)}</td>` +
    `<td style="${CELL}white-space:nowrap;">${escapeHtml(formatDeadline(notice))}</td>` +
    `<td style="${CELL}white-space:nowrap;color:${color};font-weight:600;">${escapeHtml(daysText(notice))}</td>` +
    '</tr>'
  );
}

function greeting(displayName: string | null): string {
  return displayName ? `Bună, ${displayName},` : 'Bună ziua,';
}

export function buildDigestEmail(notices: DeadlineNotice[], ctx: DigestContext): DigestEmail {
  const upcoming = notices.filter((n) => n.kind === 'upcoming').length;
  const overdue = notices.length - upcoming;
  const host = hostOf(ctx.appUrl);
  const dashboardUrl = `${ctx.appUrl.replace(/\/+$/, '')}/dashboard`;
  const subject = digestSubject(upcoming, overdue, host);
  const intro =
    'Iată situația cererilor tale de informații publice (Legea 544/2001) care au termenul aproape sau depășit:';

  const head = ['Instituție', 'Subiect', 'Termen', 'Stare']
    .map((h) => `<th style="${CELL}text-align:left;color:#6b7280;font-weight:600;">${h}</th>`)
    .join('');
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:720px;margin:0 auto;padding:16px;">` +
    `<p>${escapeHtml(greeting(ctx.displayName))}</p>` +
    `<p>${intro}</p>` +
    `<table style="border-collapse:collapse;width:100%;">` +
    `<thead><tr>${head}</tr></thead><tbody>${notices.map(row).join('')}</tbody></table>` +
    `<p style="margin-top:20px;"><a href="${escapeHtml(dashboardUrl)}" ` +
    `style="background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;">` +
    `Deschide panoul de control</a></p>` +
    `<p style="color:#6b7280;font-size:12px;">Primești acest mesaj pentru că ai activat notificările prin email. ` +
    `Le poți dezactiva sau poți schimba numărul de zile din pagina de setări a contului.</p>` +
    `</div>`;

  const lines = [
    greeting(ctx.displayName),
    '',
    intro,
    '',
    ...notices.map(
      (n) => `- ${n.request.institution_name} — ${n.request.subject} — termen ${formatDeadline(n)} — ${daysText(n)}`,
    ),
    '',
    `Panoul de control: ${dashboardUrl}`,
    '',
    'Primești acest mesaj pentru că ai activat notificările prin email; le poți schimba din setările contului.',
  ];

  return { subject, html, text: lines.join('\n') };
}
