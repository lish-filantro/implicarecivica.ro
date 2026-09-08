/** Unit tests for src/manager-544/notifications/template.ts (subject, HTML, text). */
import { describe, it, expect } from 'vitest';
import { buildDigestEmail, escapeHtml, digestSubject } from '@m544/notifications/template';
import type { DeadlineNotice } from '@m544/notifications/select';
import { req } from './_fakes';

const ctx = { appUrl: 'https://implicarecivica.ro', displayName: 'Ana' };
const deadline = new Date(2026, 8, 15, 12).toISOString();
const HOST = 'implicarecivica.ro';

function notice(kind: DeadlineNotice['kind'], daysLeft: number, extra: Partial<Parameters<typeof req>[0]> = {}) {
  const n: DeadlineNotice = { request: req({ user_id: 'u1', deadline_date: deadline, ...extra }), kind, daysLeft };
  return n;
}

describe('digestSubject', () => {
  it('singular / plural for upcoming and overdue', () => {
    expect(digestSubject(1, 0, HOST)).toBe('1 cerere cu termen apropiat – implicarecivica.ro');
    expect(digestSubject(3, 1, HOST)).toBe('3 cereri cu termen apropiat, 1 depășită – implicarecivica.ro');
    expect(digestSubject(2, 2, HOST)).toBe('2 cereri cu termen apropiat, 2 depășite – implicarecivica.ro');
    expect(digestSubject(0, 1, HOST)).toBe('1 cerere depășită – implicarecivica.ro');
    expect(digestSubject(0, 4, HOST)).toBe('4 cereri depășite – implicarecivica.ro');
    expect(digestSubject(20, 0, HOST)).toBe('20 de cereri cu termen apropiat – implicarecivica.ro');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML specials', () => {
    expect(escapeHtml('<a href="x">Tom & \'Jerry\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
  });
});

describe('buildDigestEmail', () => {
  it('subject counts kinds; html has one row per notice, ro-RO date, days text and the dashboard link', () => {
    const out = buildDigestEmail(
      [
        notice('overdue', -2, { institution_name: 'Primăria Cluj', subject: 'Buget 2026' }),
        notice('upcoming', 0, { institution_name: 'CJ Iași', subject: 'Contracte' }),
        notice('upcoming', 1),
        notice('upcoming', 3),
      ],
      ctx,
    );
    expect(out.subject).toBe('3 cereri cu termen apropiat, 1 depășită – implicarecivica.ro');
    expect(out.html).toContain('Bună, Ana');
    expect(out.html).toContain('Primăria Cluj');
    expect(out.html).toContain('Buget 2026');
    expect(out.html).toContain('septembrie 2026');
    expect(out.html).toContain('depășit cu 2 zile');
    expect(out.html).toContain('astăzi');
    expect(out.html).toContain('1 zi rămasă');
    expect(out.html).toContain('3 zile rămase');
    expect(out.html).toContain('href="https://implicarecivica.ro/dashboard"');
    expect((out.html.match(/<tr class="notice/g) ?? []).length).toBe(4);
    expect(out.text).toContain('https://implicarecivica.ro/dashboard');
    expect(out.text).toContain('Primăria Cluj');
  });

  it('escapes user-provided strings in HTML but not in text', () => {
    const out = buildDigestEmail([notice('upcoming', 2, { institution_name: 'A & B <script>', subject: '"x"' })], ctx);
    expect(out.html).toContain('A &amp; B &lt;script&gt;');
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&quot;x&quot;');
    expect(out.text).toContain('A & B <script>');
  });

  it('greets generically without a display name; singular overdue day', () => {
    const out = buildDigestEmail([notice('overdue', -1)], { ...ctx, displayName: null });
    expect(out.html).toContain('Bună ziua,');
    expect(out.html).toContain('depășit cu 1 zi');
    expect(out.subject).toBe('1 cerere depășită – implicarecivica.ro');
  });

  it('a delayed request whose deadline is not past reads as "depășit"', () => {
    const out = buildDigestEmail([notice('overdue', 4)], ctx);
    expect(out.html).toMatch(/>depășit</);
  });

  it('escapes the display name too and falls back to the raw host when appUrl is not a URL', () => {
    const out = buildDigestEmail([notice('upcoming', 1)], { appUrl: 'not a url', displayName: '<b>X</b>' });
    expect(out.html).toContain('Bună, &lt;b&gt;X&lt;/b&gt;');
    expect(out.subject.endsWith('– implicarecivica.ro')).toBe(true);
  });
});
