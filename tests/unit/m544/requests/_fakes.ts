/**
 * In-memory fakes for the requests module: sessions repository, sent counter
 * and a minimal auth client so `requireUser` can be driven without Supabase.
 */
import { randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import type { AuthClient } from '@m544/shared/auth';
import type { SentCounter } from '@m544/shared/rate-limit';
import type { RequestSession } from '@m544/shared/types/session';
import type { Request } from '@m544/shared/types/request';
import type { SessionsRepo, SessionInsert, RequestInsert } from '@m544/requests/sessions/repo';

const nowIso = () => new Date().toISOString();

export function fakeAuthClient(user: User | null): AuthClient {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'Auth session missing' } }),
    },
  };
}

export const alice = { id: 'user-alice', email: 'alice@example.com' } as User;
export const bob = { id: 'user-bob', email: 'bob@example.com' } as User;

export class FakeSessionsRepo implements SessionsRepo {
  sessions = new Map<string, RequestSession>();
  requests: Request[] = [];
  /** Make a specific method throw (simulates a DB error). */
  failOn: Partial<Record<keyof SessionsRepo, Error>> = {};

  seedSession(
    partial: Partial<RequestSession> & { user_id: string; subject: string; institution_name: string },
  ): RequestSession {
    const id = partial.id ?? randomUUID();
    const row: RequestSession = {
      id,
      cached_status: 'pending',
      total_requests: 0,
      answered_requests: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...partial,
    };
    this.sessions.set(id, row);
    return row;
  }

  private fail(method: keyof SessionsRepo) {
    const err = this.failOn[method];
    if (err) throw err;
  }

  async insertSession(data: SessionInsert): Promise<RequestSession> {
    this.fail('insertSession');
    return this.seedSession({
      user_id: data.user_id,
      name: data.name ?? undefined,
      subject: data.subject,
      institution_name: data.institution_name,
      institution_email: data.institution_email ?? undefined,
      conversation_id: data.conversation_id ?? undefined,
      total_requests: data.total_requests,
    });
  }

  async insertRequests(rows: RequestInsert[]): Promise<Request[]> {
    this.fail('insertRequests');
    const inserted = rows.map<Request>((r) => ({
      id: randomUUID(),
      user_id: r.user_id,
      session_id: r.session_id,
      institution_name: r.institution_name,
      institution_email: r.institution_email ?? undefined,
      subject: r.subject,
      request_body: r.request_body,
      status: r.status,
      date_initiated: r.date_initiated,
      created_at: nowIso(),
      updated_at: nowIso(),
    }));
    this.requests.push(...inserted);
    return inserted;
  }

  async getSessionForUser(id: string, userId: string): Promise<RequestSession | null> {
    this.fail('getSessionForUser');
    const s = this.sessions.get(id);
    return s && s.user_id === userId ? s : null;
  }

  async setTotalRequests(id: string, total: number): Promise<void> {
    this.fail('setTotalRequests');
    const s = this.sessions.get(id);
    if (!s) throw new Error(`session ${id} not found`);
    s.total_requests = total;
    s.updated_at = nowIso();
  }
}

export class FakeSentCounter implements SentCounter {
  counts = new Map<string, number>();
  calls: Array<{ userId: string; key: string; sinceIso: string }> = [];
  error: Error | null = null;

  set(key: string, n: number) {
    this.counts.set(key, n);
  }

  async countSentToday(userId: string, key: string, sinceIso: string): Promise<number> {
    this.calls.push({ userId, key, sinceIso });
    if (this.error) throw this.error;
    return this.counts.get(key) ?? 0;
  }
}
