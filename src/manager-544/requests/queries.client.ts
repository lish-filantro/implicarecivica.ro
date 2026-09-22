/**
 * Browser-side queries on `requests` used by the emails UI (manual assignment).
 * The client is injectable for tests; components use the default browser client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@m544/shared/db/browser-client';
import type { RequestStatus } from '@m544/shared/types/request';

/**
 * One question the user can attribute an email to, with the session it belongs to.
 * `session_label` is what the session select shows: the name the user gave the
 * session, else its subject, else the request's own subject (legacy sessions of one).
 */
export interface AssignableRequest {
  id: string;
  subject: string;
  institution_name: string;
  institution_email: string | null;
  status: RequestStatus;
  registration_number: string | null;
  deadline_date: string | null;
  extension_date: string | null;
  session_id: string | null;
  session_label: string;
}

const ASSIGNABLE_COLUMNS =
  'id, subject, institution_name, institution_email, status, registration_number, deadline_date, extension_date, session_id, request_sessions(id, name, subject)';

type AssignableRow = Omit<AssignableRequest, 'session_label'> & {
  request_sessions?: { id: string; name: string | null; subject: string | null } | null;
};

/**
 * Every request of the current user, grouped by session in the UI. Answered ones
 * included on purpose: a completion or a rectification often arrives after the
 * question was closed, and it still has to land somewhere. Oldest first, so the
 * questions read in the order they were sent.
 */
export async function listAssignableRequests(
  sb: SupabaseClient = createBrowserClient(),
): Promise<AssignableRequest[]> {
  const { data, error } = await sb
    .from('requests')
    .select(ASSIGNABLE_COLUMNS)
    .order('date_initiated', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as AssignableRow[]).map(({ request_sessions, ...request }) => ({
    ...request,
    session_label: request_sessions?.name || request_sessions?.subject || request.subject,
  }));
}
