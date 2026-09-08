/**
 * Sessions repository — what the session routes need on `request_sessions`
 * and `requests`. Constructed from the request-bound Supabase client so the
 * inserts run as the logged-in user (RLS), exactly like the legacy routes.
 *
 * Note: a DB trigger (006_request_sessions.sql) recomputes cached_status,
 * total_requests, answered_requests and nearest_deadline whenever a request
 * row changes; `setTotalRequests` mirrors the legacy explicit write.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestSession } from '@m544/shared/types/session';
import type { Request } from '@m544/shared/types/request';

export interface SessionInsert {
  user_id: string;
  name: string | null;
  subject: string;
  institution_name: string;
  institution_email: string | null;
  conversation_id: string | null;
  total_requests: number;
}

export interface RequestInsert {
  user_id: string;
  session_id: string;
  institution_name: string;
  institution_email: string | null;
  subject: string;
  request_body: string;
  status: 'pending';
  date_initiated: string;
}

export interface SessionsRepo {
  insertSession(data: SessionInsert): Promise<RequestSession>;
  /** Inserts the rows and returns them as stored (ids, timestamps). */
  insertRequests(rows: RequestInsert[]): Promise<Request[]>;
  /** The session only when it belongs to `userId`; null otherwise. */
  getSessionForUser(id: string, userId: string): Promise<RequestSession | null>;
  setTotalRequests(id: string, total: number): Promise<void>;
}

export class SupabaseSessionsRepo implements SessionsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async insertSession(data: SessionInsert): Promise<RequestSession> {
    const { data: row, error } = await this.sb.from('request_sessions').insert(data).select().single();
    if (error) throw error;
    return row as RequestSession;
  }

  async insertRequests(rows: RequestInsert[]): Promise<Request[]> {
    const { data, error } = await this.sb.from('requests').insert(rows).select();
    if (error) throw error;
    return (data ?? []) as Request[];
  }

  async getSessionForUser(id: string, userId: string): Promise<RequestSession | null> {
    const { data, error } = await this.sb
      .from('request_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as RequestSession | null) ?? null;
  }

  async setTotalRequests(id: string, total: number): Promise<void> {
    const { error } = await this.sb.from('request_sessions').update({ total_requests: total }).eq('id', id);
    if (error) throw error;
  }
}
