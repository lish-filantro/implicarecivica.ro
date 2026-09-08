/**
 * Browser-side email queries (moved 1:1 from lib/supabase/email-queries.ts).
 * The client is injectable for tests; components use the default browser client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@m544/shared/db/clients';
import type { Email, EmailType } from '@m544/shared/types/email';

export async function listEmails(type?: EmailType, sb: SupabaseClient = createBrowserClient()): Promise<Email[]> {
  let query = sb.from('emails').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Email[];
}

export async function getEmailById(id: string, sb: SupabaseClient = createBrowserClient()): Promise<Email | null> {
  const { data, error } = await sb.from('emails').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Email;
}

export async function markEmailAsRead(id: string, sb: SupabaseClient = createBrowserClient()): Promise<void> {
  const { error } = await sb.from('emails').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function deleteEmail(id: string, sb: SupabaseClient = createBrowserClient()): Promise<void> {
  const { error } = await sb.from('emails').delete().eq('id', id);
  if (error) throw error;
}

export async function listEmailsByRequestId(
  requestId: string,
  sb: SupabaseClient = createBrowserClient(),
): Promise<Email[]> {
  const { data, error } = await sb
    .from('emails')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Email[];
}

export async function getUnreadCount(sb: SupabaseClient = createBrowserClient()): Promise<number> {
  const { count, error } = await sb
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'received')
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}
