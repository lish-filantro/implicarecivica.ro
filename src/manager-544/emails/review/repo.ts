/**
 * Persistence specific to manual review: the `classification_feedback` rows
 * (migration 017). Built on the SESSION client so the RLS policy (owner of the
 * email) applies. Emails/requests reads and writes reuse the shared repos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailCategory } from '@m544/shared/types/request';

export interface FeedbackRow {
  email_id: string;
  user_id: string;
  previous_category: EmailCategory | null;
  new_category: EmailCategory;
  note: string | null;
}

export interface ReviewRepo {
  insertFeedback(row: FeedbackRow): Promise<void>;
}

export class SupabaseReviewRepo implements ReviewRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async insertFeedback(row: FeedbackRow): Promise<void> {
    const { error } = await this.sb.from('classification_feedback').insert(row);
    if (error) throw error;
  }
}
