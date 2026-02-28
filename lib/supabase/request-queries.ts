import { createClient } from './client';
import type { Request, RequestStatus } from '../types/request';

export async function listRequests(status?: RequestStatus): Promise<Request[]> {
  const supabase = createClient();
  let query = supabase
    .from('requests')
    .select('*')
    .order('date_initiated', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRequestById(id: string): Promise<Request | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}
