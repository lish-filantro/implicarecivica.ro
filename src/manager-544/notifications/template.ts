/**
 * The daily digest email (Romanian): subject with correct plural forms, an HTML
 * table of deadlines (institution, subject, deadline, days left), a section for
 * the emails the pipeline could not attribute, and a plain text twin. Every
 * user-provided string is escaped before it reaches the HTML.
 *
 * Either part can be empty — the digest goes out when at least one has content,
 * so an inbox full of unattributed answers is not silent just because no
 * deadline happens to be near.
 */
import { getEffectiveDeadline } from '@m544/requests/utils/deadlines';
import type { DeadlineNotice } from './select';
import type { ReviewNotice } from './repo';

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

/** "1 email", "3 emailuri", "20 de emailuri". */
function emailuri(n: number): string {
  if (n === 1) return '1 email';
  return n < 20 ? `${n} emailuri` : `${n} de emailuri`;
}

export function digestSubject(upcoming: number, overdue: number, host: string, toAttribute = 0): string {
  const parts: string[] = [];
  if (upcoming > 0) parts.push(`${cereri(upcoming)} cu termen apropiat`);
  if (overdue > 0) {
    const adj = overdue === 1 ? 'depășită' : 'depășite';
    parts.push(upcoming > 0 ? `${overdue} ${adj}` : `${cereri(overdue)} ${adj}`);
  }
  if (toAttribute > 0) parts.push(`${emailuri(toAttribute)} de atribuit`);
  return `${parts.join(', ')} – ${host}`;
}

// Termenele se stochează ca sfârşit de zi UTC (`…T23:59:59.999Z`), deci ziua se citeşte în UTC:
// formatat în ora locală a unui runtime la UTC+3, un termen din 18 septembrie ar apărea ca 19.
const dateFormat = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

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

const DEADLINE_INTRO =
  'Iată situația cererilor tale de informații publice (Legea 544/2001) care au termenul aproape sau depășit:';
const REVIEW_INTRO =
  'Am primit emailuri pe care nu le-am putut atribui automat niciunei întrebări. Le găsești în folderul „De revizuit”, de unde le poți atribui manual:';

function deadlineTable(notices: DeadlineNotice[]): string {
  const head = ['Instituție', 'Subiect', 'Termen', 'Stare']
    .map((h) => `<th style="${CELL}text-align:left;color:#6b7280;font-weight:600;">${h}</th>`)
    .join('');
  return (
    `<p>${DEADLINE_INTRO}</p>` +
    `<table style="border-collapse:collapse;width:100%;">` +
    `<thead><tr>${head}</tr></thead><tbody>${notices.map(row).join('')}</tbody></table>`
  );
}

function reviewSection(reviews: ReviewNotice[], emailsUrl: string): string {
  const items = reviews
    .map((r) => `<li style="margin-bottom:4px;">${escapeHtml(r.fromEmail)} — ${escapeHtml(r.subject)}</li>`)
    .join('');
  return (
    `<p style="margin-top:24px;font-weight:600;">De revizuit</p>` +
    `<p>${REVIEW_INTRO}</p>` +
    `<ul style="font-size:14px;padding-left:20px;">${items}</ul>` +
    `<p><a href="${escapeHtml(emailsUrl)}">Deschide emailurile</a></p>`
  );
}

export function buildDigestEmail(
  notices: DeadlineNotice[],
  ctx: DigestContext,
  reviews: ReviewNotice[] = [],
): DigestEmail {
  const upcoming = notices.filter((n) => n.kind === 'upcoming').length;
  const overdue = notices.length - upcoming;
  const host = hostOf(ctx.appUrl);
  const base = ctx.appUrl.replace(/\/+$/, '');
  const dashboardUrl = `${base}/dashboard`;
  const emailsUrl = `${base}/emails`;
  const subject = digestSubject(upcoming, overdue, host, reviews.length);

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:720px;margin:0 auto;padding:16px;">` +
    `<p>${escapeHtml(greeting(ctx.displayName))}</p>` +
    (notices.length ? deadlineTable(notices) : '') +
    (reviews.length ? reviewSection(reviews, emailsUrl) : '') +
    `<p style="margin-top:20px;"><a href="${escapeHtml(dashboardUrl)}" ` +
    `style="background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;">` +
    `Deschide panoul de control</a></p>` +
    `<p style="color:#6b7280;font-size:12px;">Primești acest mesaj pentru că ai activat notificările prin email. ` +
    `Le poți dezactiva sau poți schimba numărul de zile din pagina de setări a contului.</p>` +
    `</div>`;

  const lines = [greeting(ctx.displayName), ''];
  if (notices.length) {
    lines.push(
      DEADLINE_INTRO,
      '',
      ...notices.map(
        (n) => `- ${n.request.institution_name} — ${n.request.subject} — termen ${formatDeadline(n)} — ${daysText(n)}`,
      ),
      '',
    );
  }
  if (reviews.length) {
    lines.push('De revizuit', '', REVIEW_INTRO, '', ...reviews.map((r) => `- ${r.fromEmail} — ${r.subject}`), '', `Emailuri: ${emailsUrl}`, '');
  }
  lines.push(
    `Panoul de control: ${dashboardUrl}`,
    '',
    'Primești acest mesaj pentru că ai activat notificările prin email; le poți schimba din setările contului.',
  );

  return { subject, html, text: lines.join('\n') };
}
