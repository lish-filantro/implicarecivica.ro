/**
 * Contract tests for POST /api/emails/send (src/manager-544/emails/send.ts).
 *
 * Behaviour = legacy route, plus: daily limit enforced on EVERY send (not only
 * with request_id), zod validation, request_id must belong to the user.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSendEmailHandler, type SendEmailDeps, type EmailSender, type OutgoingEmail } from '@m544/emails/send';
import { SupabaseSendStore } from '@m544/emails/store';
import { SupabaseSentCounter, DAILY_LIMIT } from '@m544/shared/rate-limit';
import { fakeSupabase, byTable, type RecordedQuery, type QueryResult } from './_fake-client';

const alice = { id: 'u1', email: 'alice@example.ro' } as User;
const REQ_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';

type SendResult = { data: { id: string } | null; error: { message: string } | null };

function sender(result: SendResult = { data: { id: 're_1' }, error: null }) {
  const sent: OutgoingEmail[] = [];
  const s: EmailSender & { sent: OutgoingEmail[] } = {
    sent,
    send: async (p) => {
      sent.push(p);
      return result;
    },
  };
  return s;
}

interface Scenario {
  user?: User | null;
  profile?: { display_name: string | null; mailcow_email: string | null } | null;
  sentToday?: number;
  ownsRequest?: boolean;
  insert?: QueryResult;
  resend?: ReturnType<typeof sender>;
}

function build(s: Scenario = {}) {
  const profile =
    s.profile === undefined ? { display_name: 'Alice Pop', mailcow_email: 'alice.pop@implicarecivica.ro' } : s.profile;
  const sb = fakeSupabase(
    s.user === undefined ? alice : s.user,
    byTable({
      profiles: { data: profile, error: null },
      'requests:select': (q: RecordedQuery) =>
        q.count
          ? { count: s.sentToday ?? 0, error: null }
          : { data: s.ownsRequest === false ? [] : [{ id: REQ_ID }], error: null },
      'requests:update': { data: null, error: null },
      'emails:insert':
        s.insert ?? ((q: RecordedQuery) => ({ data: { id: 'e1', ...(q.payload as object) }, error: null })),
    }),
  );
  const resend = s.resend ?? sender();
  const deps: SendEmailDeps = {
    createClient: async () => sb as unknown as SupabaseClient,
    store: (c) => new SupabaseSendStore(c),
    counter: (c) => new SupabaseSentCounter(c),
    resend,
  };
  return { handler: createSendEmailHandler(() => deps), sb, resend };
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = { to: 'registratura@primaria.ro', subject: 'Cerere 544', body: '<p>Buna ziua</p>' };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/emails/send', () => {
  it('401 when not logged in', async () => {
    const { handler } = build({ user: null });
    const res = await handler(post(valid));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Neautorizat' });
  });

  it('400 on invalid bodies (missing fields, bad email, bad uuid, bad JSON)', async () => {
    const { handler, resend } = build();
    const bodies: unknown[] = [
      {},
      { ...valid, to: 'not-an-email' },
      { ...valid, subject: '' },
      { ...valid, body: '' },
      { ...valid, request_id: 'abc' },
      { ...valid, parent_email_id: 'abc' },
      '{bad json',
    ];
    for (const body of bodies) {
      const res = await handler(post(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(resend.sent).toHaveLength(0);
  });

  it('400 when the user has no platform address', async () => {
    const { handler, resend } = build({ profile: { display_name: 'A', mailcow_email: null } });
    const res = await handler(post(valid));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Nu ai o adresă de email de platformă/);
    expect(resend.sent).toHaveLength(0);
  });

  it('429 when the daily limit is reached, even without request_id', async () => {
    const { handler, resend } = build({ sentToday: DAILY_LIMIT });
    const res = await handler(post(valid));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(
      `Limita zilnică de ${DAILY_LIMIT} cereri către această adresă a fost atinsă.`,
    );
    expect(resend.sent).toHaveLength(0);
  });

  it("counts today's sends per user + institution address (case-insensitive)", async () => {
    const { handler, sb } = build({ sentToday: 3 });
    await handler(post({ ...valid, to: 'Registratura@Primaria.RO' }));
    const count = sb.queries.find((q) => q.table === 'requests' && q.count === 'exact')!;
    expect(count.modifiers).toContain('head');
    expect(count.filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', args: ['user_id', 'u1'] },
        { op: 'ilike', args: ['institution_email', 'registratura@primaria.ro'] },
        { op: 'gte', args: ['date_sent', expect.stringMatching(/^\d{4}-/)] },
      ]),
    );
  });

  it('404 when request_id does not belong to the user; nothing is sent', async () => {
    const { handler, resend } = build({ ownsRequest: false });
    const res = await handler(post({ ...valid, request_id: REQ_ID }));
    expect(res.status).toBe(404);
    expect(resend.sent).toHaveLength(0);
  });

  it('500 with the provider message when Resend fails; nothing saved', async () => {
    const resend = sender({ data: null, error: { message: 'Domain not verified' } });
    const { handler, sb } = build({ resend });
    const res = await handler(post(valid));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Eroare la trimitere: Domain not verified' });
    expect(sb.queries.some((q) => q.table === 'emails')).toBe(false);
  });

  it('200 + warning when the email went out but the DB insert failed', async () => {
    const { handler } = build({ insert: { data: null, error: { message: 'boom' } } });
    const res = await handler(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      resend_id: 're_1',
      warning: 'Email trimis, dar nu a fost salvat în baza de date',
    });
  });

  it('sends from "<display name> <mailcow>", saves a sent/trimise row and returns it', async () => {
    const { handler, sb, resend } = build();
    const res = await handler(post(valid));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resend_id).toBe('re_1');
    expect(body.email).toMatchObject({ id: 'e1', to_email: valid.to, subject: valid.subject });

    expect(resend.sent).toEqual([
      {
        from: 'Alice Pop <alice.pop@implicarecivica.ro>',
        to: [valid.to],
        subject: valid.subject,
        html: valid.body,
        headers: {},
      },
    ]);
    const insert = sb.queries.find((q) => q.table === 'emails' && q.op === 'insert')!;
    expect(insert.payload).toEqual({
      user_id: 'u1',
      request_id: null,
      parent_email_id: null,
      message_id: 're_1',
      type: 'sent',
      category: 'trimise',
      from_email: 'alice.pop@implicarecivica.ro',
      to_email: valid.to,
      subject: valid.subject,
      body: valid.body,
      processing_status: 'completed',
      is_read: true,
    });
    expect(insert.modifiers).toContain('single');
    expect(sb.queries.some((q) => q.table === 'requests' && q.op === 'update')).toBe(false);
  });

  it('falls back to "Utilizator" when the profile has no display name', async () => {
    const { handler, resend } = build({ profile: { display_name: null, mailcow_email: 'x@implicarecivica.ro' } });
    await handler(post(valid));
    expect(resend.sent[0].from).toBe('Utilizator <x@implicarecivica.ro>');
  });

  it('with request_id: adds the X-Request-ID header, links the row and marks the request pending/sent', async () => {
    const { handler, sb, resend } = build();
    const res = await handler(post({ ...valid, request_id: REQ_ID, parent_email_id: PARENT_ID }));
    expect(res.status).toBe(200);
    expect(resend.sent[0].headers).toEqual({ 'X-Request-ID': REQ_ID });

    const insert = sb.queries.find((q) => q.table === 'emails' && q.op === 'insert')!;
    expect(insert.payload).toMatchObject({ request_id: REQ_ID, parent_email_id: PARENT_ID });

    const update = sb.queries.find((q) => q.table === 'requests' && q.op === 'update')!;
    expect(update.payload).toEqual({ status: 'pending', date_sent: expect.stringMatching(/^\d{4}-/) });
    expect(update.filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', args: ['id', REQ_ID] },
        { op: 'eq', args: ['user_id', 'u1'] },
      ]),
    );
  });
});
