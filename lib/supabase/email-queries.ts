import { createClient } from './client';
import type { Email, EmailType } from '../types/email';

export async function listEmails(type?: EmailType): Promise<Email[]> {
  const supabase = createClient();
  let query = supabase
    .from('emails')
    .select('*')
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getEmailById(id: string): Promise<Email | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function markEmailAsRead(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('emails')
    .update({ is_read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEmail(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('emails')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function listEmailsByRequestId(requestId: string): Promise<Email[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'received')
    .eq('is_read', false);

  if (error) throw error;
  return count ?? 0;
}
