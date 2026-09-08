/**
 * Persistence needed by the send route, on the SESSION client so RLS applies:
 * sender identity, request ownership, the `sent` email row, request status.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Email } from '@m544/shared/types/email';
import { SupabaseProfilesRepo, type SenderIdentity } from '@m544/shared/db/profiles-repo';

export interface SentEmailRow {
  user_id: string;
  request_id: string | null;
  parent_email_id: string | null;
  message_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
}

export interface SendStore {
  getSenderIdentity(userId: string): Promise<SenderIdentity | null>;
  /** True when the request exists and is visible to (owned by) the user. */
  ownsRequest(requestId: string, userId: string): Promise<boolean>;
  /** Saves the outgoing email as `sent` / `trimise`; throws on DB error. */
  insertSentEmail(row: SentEmailRow): Promise<Email>;
  /** status → pending, date_sent → sentAtIso. Errors are logged, not thrown (the email is already out). */
  markRequestSent(requestId: string, userId: string, sentAtIso: string): Promise<void>;
}

export class SupabaseSendStore implements SendStore {
  private readonly profiles: SupabaseProfilesRepo;

  constructor(private readonly sb: SupabaseClient) {
    this.profiles = new SupabaseProfilesRepo(sb);
  }

  getSenderIdentity(userId: string): Promise<SenderIdentity | null> {
    return this.profiles.getSenderIdentity(userId);
  }

  async ownsRequest(requestId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.sb
      .from('requests')
      .select('id')
      .eq('id', requestId)
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async insertSentEmail(row: SentEmailRow): Promise<Email> {
    const { data, error } = await this.sb
      .from('emails')
      .insert({
        ...row,
        type: 'sent',
        category: 'trimise',
        processing_status: 'completed',
        is_read: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Email;
  }

  async markRequestSent(requestId: string, userId: string, sentAtIso: string): Promise<void> {
    const { error } = await this.sb
      .from('requests')
      .update({ status: 'pending', date_sent: sentAtIso })
      .eq('id', requestId)
      .eq('user_id', userId);
    if (error) console.error('[emails/send] request status update failed:', error.message);
  }
}
