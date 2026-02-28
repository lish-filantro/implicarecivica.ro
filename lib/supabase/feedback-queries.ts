import { createClient } from './client';
import type { Feedback, CreateFeedbackPayload } from '../types/feedback';

export async function createFeedback(payload: CreateFeedbackPayload): Promise<Feedback> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
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
  return data;
}

export async function listMyFeedback(): Promise<Feedback[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
