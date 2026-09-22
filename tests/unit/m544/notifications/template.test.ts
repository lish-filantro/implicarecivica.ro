/** Unit tests for src/manager-544/notifications/template.ts (subject, HTML, text). */
import { describe, it, expect } from 'vitest';
import { buildDigestEmail, escapeHtml, digestSubject } from '@m544/notifications/template';
import type { DeadlineNotice } from '@m544/notifications/select';
import type { ReviewNotice } from '@m544/notifications/repo';
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

const review = (over: Partial<ReviewNotice> = {}): ReviewNotice => ({
  emailId: 'e1',
  fromEmail: 'Registratura <registratura@primarie.ro>',
  subject: 'Adresa nr. 4521',
  receivedAt: '2026-09-15T08:00:00.000Z',
  ...over,
});

describe('digestSubject — emails waiting to be attributed', () => {
  it('counts them on their own and next to the deadline counts', () => {
    expect(digestSubject(0, 0, HOST, 1)).toBe('1 email de atribuit – implicarecivica.ro');
    expect(digestSubject(0, 0, HOST, 3)).toBe('3 emailuri de atribuit – implicarecivica.ro');
    expect(digestSubject(0, 0, HOST, 20)).toBe('20 de emailuri de atribuit – implicarecivica.ro');
    expect(digestSubject(1, 0, HOST, 2)).toBe(
      '1 cerere cu termen apropiat, 2 emailuri de atribuit – implicarecivica.ro',
    );
  });
});

describe('buildDigestEmail — emails waiting to be attributed', () => {
  it('adds a section with the sender, the subject and a link to the emails page', () => {
    const out = buildDigestEmail([], ctx, [review()]);
    expect(out.html).toContain('De revizuit');
    expect(out.html).toContain('registratura@primarie.ro');
    expect(out.html).toContain('Adresa nr. 4521');
    expect(out.html).toContain('https://implicarecivica.ro/emails');
    expect(out.text).toContain('Adresa nr. 4521');
    expect(out.text).toContain('https://implicarecivica.ro/emails');
  });

  it('omits the deadline table entirely when there are only emails to attribute', () => {
    const out = buildDigestEmail([], ctx, [review()]);
    expect(out.html).not.toContain('<table');
    expect(out.subject).toBe('1 email de atribuit – implicarecivica.ro');
  });

  it('omits the section when there is nothing to attribute', () => {
    const out = buildDigestEmail([notice('upcoming', 1)], ctx);
    expect(out.html).not.toContain('De revizuit');
    expect(out.text).not.toContain('De revizuit');
  });

  it('escapes the sender and the subject of an email', () => {
    const out = buildDigestEmail([], ctx, [review({ fromEmail: '<b>x</b>@y.ro', subject: '"Adresă" & co' })]);
    expect(out.html).toContain('&lt;b&gt;x&lt;/b&gt;@y.ro');
    expect(out.html).toContain('&quot;Adresă&quot; &amp; co');
    expect(out.html).not.toContain('<b>x</b>');
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

  /**
   * The legal deadline is stored as the end of its day in UTC (`…T23:59:59.999Z`). Formatted in
   * the runtime's local time, a deadline of 18 September reads as 19 September on any host at
   * UTC+1 or later — so the date is formatted with `timeZone: 'UTC'`. This case fails under
   * `TZ=Europe/Bucharest` if that option is dropped.
   */
  it('renders an end-of-day deadline as its own day, whatever the server time zone', () => {
    const out = buildDigestEmail([notice('upcoming', 0, { deadline_date: '2026-09-18T23:59:59.999Z' })], ctx);
    expect(out.html).toContain('18 septembrie 2026');
    expect(out.html).not.toContain('19 septembrie 2026');
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
