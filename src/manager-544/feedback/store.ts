/**
 * Feedback persistence on the SESSION client (RLS: users insert their own rows).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Feedback, FeedbackCategory } from '@m544/shared/types/feedback';

export interface FeedbackInsert {
  user_id: string;
  category: FeedbackCategory;
  message: string;
  page_url: string | null;
}

export interface FeedbackStore {
  /** Inserts and returns the saved row; throws on DB error. */
  insert(row: FeedbackInsert): Promise<Feedback>;
}

export class SupabaseFeedbackStore implements FeedbackStore {
  constructor(private readonly sb: SupabaseClient) {}

  async insert(row: FeedbackInsert): Promise<Feedback> {
    const { data, error } = await this.sb.from('feedback').insert(row).select().single();
    if (error) throw error;
    return data as Feedback;
  }
}
