/**
 * Fakes for the notifications module: in-memory NotificationsRepo, a recording
 * EmailSender, request fixtures and a tiny chainable Supabase stand-in used by
 * the repo test (records every query; answers come from a responder).
 */
import { randomUUID } from 'node:crypto';
import type { Request } from '@m544/shared/types/request';
import type { EmailSender, OutgoingEmail, SendResult } from '@m544/emails/send';
import type { NotificationsRepo, OptedInUser, SentEntry } from '@m544/notifications/repo';

const nowIso = () => new Date().toISOString();

export function req(partial: Partial<Request> & { user_id: string }): Request {
  const id = partial.id ?? randomUUID();
  return {
    id,
    institution_name: partial.institution_name ?? 'Primăria Test',
    subject: partial.subject ?? 'Cerere informații publice - Legea 544/2001',
    status: 'received',
    date_initiated: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
    ...partial,
  };
}

/** ISO timestamp of local midnight `n` days after `from` (matches the deadline arithmetic). */
export function daysFrom(from: Date, n: number): string {
  const d = new Date(from.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export class FakeNotificationsRepo implements NotificationsRepo {
  users: OptedInUser[] = [];
  requests = new Map<string, Request[]>();
  sent = new Map<string, SentEntry[]>(); // key: `${userId}|${dateIso}`
  markSentCalls: Array<{ userId: string; entries: SentEntry[]; dateIso: string }> = [];
  /** Throw when listing requests for this user (error-path tests). */
  failFor: string | null = null;

  addUser(u: Partial<OptedInUser> & { userId: string }): OptedInUser {
    const user: OptedInUser = {
      email: `${u.userId}@example.ro`,
      displayName: null,
      deadlineDays: 3,
      ...u,
    };
    this.users.push(user);
    return user;
  }

  addRequest(partial: Partial<Request> & { user_id: string }): Request {
    const r = req(partial);
    this.requests.set(r.user_id, [...(this.requests.get(r.user_id) ?? []), r]);
    return r;
  }

  async listOptedInUsers() {
    return [...this.users];
  }

  async listOpenRequests(userId: string) {
    if (this.failFor === userId) throw new Error(`boom for ${userId}`);
    return (this.requests.get(userId) ?? []).filter((r) => r.status !== 'answered');
  }

  async listSentToday(userId: string, dateIso: string) {
    return [...(this.sent.get(`${userId}|${dateIso}`) ?? [])];
  }

  async markSent(userId: string, entries: SentEntry[], dateIso: string) {
    this.markSentCalls.push({ userId, entries, dateIso });
    const key = `${userId}|${dateIso}`;
    const existing = this.sent.get(key) ?? [];
    for (const e of entries) {
      if (!existing.some((x) => x.requestId === e.requestId && x.kind === e.kind)) existing.push(e);
    }
    this.sent.set(key, existing);
  }
}

export class FakeSender implements EmailSender {
  sent: OutgoingEmail[] = [];
  /** Recipients whose send should fail with a Resend-style error. */
  failTo = new Set<string>();

  async send(payload: OutgoingEmail): Promise<SendResult> {
    if (payload.to.some((t) => this.failTo.has(t))) return { data: null, error: { message: 'resend down' } };
    this.sent.push(payload);
    return { data: { id: `re_${this.sent.length}` }, error: null };
  }
}

// ─── Minimal Supabase stand-in for the repo test ────────────────────────────

export interface RecordedQuery {
  table: string;
  op: 'select' | 'upsert';
  payload?: unknown;
  options?: unknown;
  filters: Array<{ op: string; args: unknown[] }>;
}
export type QueryResult = { data?: unknown; error?: { message: string } | null };
export type Responder = (q: RecordedQuery) => QueryResult;

class Builder implements PromiseLike<QueryResult> {
  constructor(private readonly q: RecordedQuery, private readonly respond: Responder) {}
  private f(op: string, ...args: unknown[]) {
    this.q.filters.push({ op, args });
    return this;
  }
  select(cols?: string) {
    if (this.q.op !== 'upsert') this.q.op = 'select';
    this.q.filters.push({ op: 'select', args: [cols ?? '*'] });
    return this;
  }
  upsert(payload: unknown, options?: unknown) {
    this.q.op = 'upsert';
    this.q.payload = payload;
    this.q.options = options;
    return this;
  }
  eq(c: string, v: unknown) { return this.f('eq', c, v); }
  neq(c: string, v: unknown) { return this.f('neq', c, v); }
  order(c: string, o?: unknown) { return this.f('order', c, o); }
  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((v: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.respond(this.q)).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabase {
  from(table: string): Builder;
  auth: { admin: { getUserById(id: string): Promise<{ data: { user: { email?: string } | null }; error: null }> } };
  queries: RecordedQuery[];
}

export function fakeSupabase(respond: Responder, emails: Record<string, string | undefined> = {}): FakeSupabase {
  const queries: RecordedQuery[] = [];
  return {
    queries,
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: id in emails ? { email: emails[id] } : null },
          error: null,
        }),
      },
    },
    from(table: string) {
      const q: RecordedQuery = { table, op: 'select', filters: [] };
      queries.push(q);
      return new Builder(q, respond);
    },
  };
}
