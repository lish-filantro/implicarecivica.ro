/**
 * Browser-side queries on `requests` used by the emails UI (manual review).
 * The client is injectable for tests; components use the default browser client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@m544/shared/db/browser-client';
import type { RequestStatus } from '@m544/shared/types/request';

/** Compact row for the "assign to request" select. */
export interface OpenRequestOption {
  id: string;
  subject: string;
  institution_name: string;
  status: RequestStatus;
  registration_number: string | null;
}

/** The user's requests not yet answered, newest first (RLS scopes to the caller). */
export async function listOpenRequests(sb: SupabaseClient = createBrowserClient()): Promise<OpenRequestOption[]> {
  const { data, error } = await sb
    .from('requests')
    .select('id, subject, institution_name, status, registration_number')
    .neq('status', 'answered')
    .order('date_initiated', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OpenRequestOption[];
}
