/**
 * Browser-side queries on `request_sessions` and `requests`, used by the UI
 * (dashboard, requests/add). Moved 1:1 from lib/supabase/{session,request}-queries.
 * Runs under the logged-in user's RLS via the browser client.
 */
import { createBrowserClient } from '@m544/shared/db/browser-client';
import type { RequestSession, RequestSessionWithRequests, SessionStatus } from '@m544/shared/types/session';
import type { Request, RequestStatus } from '@m544/shared/types/request';
import { groupRequestsBySession } from './group';

/** PostgREST code for "no rows" from `.single()`. */
const NO_ROWS = 'PGRST116';

// ─── Sessions ────────────────────────────────────────────────────────────────

/** All sessions of the current user, newest first, optionally filtered by cached status. */
export async function listSessions(status?: SessionStatus): Promise<RequestSession[]> {
  const supabase = createBrowserClient();
  let query = supabase.from('request_sessions').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('cached_status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSessionById(id: string): Promise<RequestSession | null> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.from('request_sessions').select('*').eq('id', id).single();
  if (error) {
    if (error.code === NO_ROWS) return null;
    throw error;
  }
  return data;
}

/** A session with its requests (oldest first). */
export async function getSessionWithRequests(id: string): Promise<RequestSessionWithRequests | null> {
  const supabase = createBrowserClient();
  const { data: session, error: sessionError } = await supabase
    .from('request_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (sessionError) {
    if (sessionError.code === NO_ROWS) return null;
    throw sessionError;
  }

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true });
  if (requestsError) throw requestsError;

  return { ...session, requests: requests || [] };
}

/** All sessions with their requests grouped (dashboard). */
export async function listSessionsWithRequests(): Promise<RequestSessionWithRequests[]> {
  const supabase = createBrowserClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from('request_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  if (sessionsError) throw sessionsError;
  if (!sessions?.length) return [];

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .in('session_id', sessions.map((s) => s.id))
    .order('created_at', { ascending: true });
  if (requestsError) throw requestsError;

  return groupRequestsBySession(sessions, requests || []);
}

/**
 * Create a session with one request per question, directly from the browser.
 * Prefer POST /api/sessions/create (it enforces the daily limit); kept 1:1 for compatibility.
 */
export async function createSessionWithRequests(payload: {
  name?: string;
  subject: string;
  institution_name: string;
  institution_email?: string;
  conversation_id?: string;
  questions: string[];
}): Promise<RequestSessionWithRequests> {
  const supabase = createBrowserClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: session, error: sessionError } = await supabase
    .from('request_sessions')
    .insert({
      user_id: user.id,
      name: payload.name || null,
      subject: payload.subject,
      institution_name: payload.institution_name,
      institution_email: payload.institution_email,
      conversation_id: payload.conversation_id,
      total_requests: payload.questions.length,
    })
    .select()
    .single();
  if (sessionError) throw sessionError;

  const requestInserts = payload.questions.map((question) => ({
    user_id: user.id,
    session_id: session.id,
    institution_name: payload.institution_name,
    institution_email: payload.institution_email,
    subject: payload.subject,
    request_body: question,
    status: 'pending' as const,
    date_initiated: new Date().toISOString(),
  }));
  const { data: requests, error: requestsError } = await supabase.from('requests').insert(requestInserts).select();
  if (requestsError) throw requestsError;

  return { ...session, requests: requests || [] };
}

/** Delete a session and its requests (requests have ON DELETE SET NULL, so they go first). */
export async function deleteSession(id: string): Promise<void> {
  const supabase = createBrowserClient();
  const { error: reqError } = await supabase.from('requests').delete().eq('session_id', id);
  if (reqError) throw reqError;

  const { error } = await supabase.from('request_sessions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Requests ────────────────────────────────────────────────────────────────

/** The current user's requests, newest first, optionally filtered by status. */
export async function listRequests(status?: RequestStatus): Promise<Request[]> {
  const supabase = createBrowserClient();
  let query = supabase.from('requests').select('*').order('date_initiated', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRequestById(id: string): Promise<Request | null> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
  if (error) {
    if (error.code === NO_ROWS) return null;
    throw error;
  }
  return data;
}
