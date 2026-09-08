/**
 * Browser-side feedback queries (moved 1:1 from lib/supabase/feedback-queries.ts).
 * The client is injectable for tests; components use the default browser client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@m544/shared/db/clients';
import type { Feedback, CreateFeedbackPayload } from '@m544/shared/types/feedback';

export async function createFeedback(
  payload: CreateFeedbackPayload,
  sb: SupabaseClient = createBrowserClient(),
): Promise<Feedback> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await sb
    .from('feedback')
    .insert({
      user_id: user.id,
      category: payload.category,
      message: payload.message,
      page_url: payload.page_url || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Feedback;
}

export async function listMyFeedback(sb: SupabaseClient = createBrowserClient()): Promise<Feedback[]> {
  const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Feedback[];
}
