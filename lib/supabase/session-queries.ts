import { createClient } from './client';
import type { RequestSession, RequestSessionWithRequests, SessionStatus } from '../types/session';
import type { Request } from '../types/request';

/**
 * List all sessions for the current user, optionally filtered by status
 */
export async function listSessions(status?: SessionStatus): Promise<RequestSession[]> {
  const supabase = createClient();
  let query = supabase
    .from('request_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('cached_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get a single session by ID
 */
export async function getSessionById(id: string): Promise<RequestSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('request_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Get a session with all its requests loaded
 */
export async function getSessionWithRequests(id: string): Promise<RequestSessionWithRequests | null> {
  const supabase = createClient();

  const { data: session, error: sessionError } = await supabase
    .from('request_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (sessionError) {
    if (sessionError.code === 'PGRST116') return null;
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

/**
 * List sessions with their requests (for dashboard display)
 */
export async function listSessionsWithRequests(): Promise<RequestSessionWithRequests[]> {
  const supabase = createClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from('request_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (sessionsError) throw sessionsError;
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (requestsError) throw requestsError;

  // Group requests by session_id
  const requestsBySession = new Map<string, Request[]>();
  for (const req of requests || []) {
    const list = requestsBySession.get(req.session_id) || [];
    list.push(req);
    requestsBySession.set(req.session_id, list);
  }

  return sessions.map((session) => ({
    ...session,
    requests: requestsBySession.get(session.id) || [],
  }));
}

/**
 * Create a session with N requests (one per question)
 */
export async function createSessionWithRequests(payload: {
  subject: string;
  institution_name: string;
  institution_email?: string;
  conversation_id?: string;
  questions: string[];
}): Promise<RequestSessionWithRequests> {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('request_sessions')
    .insert({
      user_id: user.id,
      subject: payload.subject,
      institution_name: payload.institution_name,
      institution_email: payload.institution_email,
      conversation_id: payload.conversation_id,
      total_requests: payload.questions.length,
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // Create individual requests
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

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .insert(requestInserts)
    .select();

  if (requestsError) throw requestsError;

  return { ...session, requests: requests || [] };
}

/**
 * Delete a session and all its requests
 */
export async function deleteSession(id: string): Promise<void> {
  const supabase = createClient();

  // Requests have ON DELETE SET NULL, so we delete them explicitly first
  const { error: reqError } = await supabase
    .from('requests')
    .delete()
    .eq('session_id', id);

  if (reqError) throw reqError;

  const { error } = await supabase
    .from('request_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
