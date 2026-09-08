/**
 * Emails repository — the only place that knows how `emails` rows are queried.
 * Interface first (so the pipeline is unit-testable with an in-memory fake),
 * Supabase implementation below.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Email, EmailType, ProcessingStatus } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';

export type EmailInsert = {
  id?: string;
  user_id: string;
  request_id?: string | null;
  parent_email_id?: string | null;
  message_id: string;
  type: EmailType;
  category?: EmailCategory | null;
  from_email: string;
  to_email: string;
  subject: string;
  body?: string | null;
  attachments?: unknown[];
  pdf_file_path?: string | null;
  processing_status: ProcessingStatus;
  is_read?: boolean;
  received_at?: string | null;
};

export type EmailPatch = Partial<
  Pick<
    Email,
    | 'request_id'
    | 'category'
    | 'ocr_text'
    | 'ocr_processed'
    | 'ocr_processed_at'
    | 'ai_extracted_data'
    | 'registration_number'
    | 'processing_status'
    | 'retry_count'
    | 'error_log'
    | 'is_read'
    | 'needs_review'
  >
>;

export type InsertResult = { ok: true; email: Email } | { ok: false; duplicate: true };

export interface EmailsRepo {
  getById(id: string): Promise<Email | null>;
  /** Insert; a (user_id, message_id) unique violation is reported as duplicate. */
  insert(data: EmailInsert): Promise<InsertResult>;
  update(id: string, patch: EmailPatch): Promise<void>;
  /** Thread detection: our email whose Message-ID equals the given one. */
  findIdByMessageId(messageId: string): Promise<string | null>;
  getRequestIdOfEmail(emailId: string): Promise<string | null>;
  /** Cron batch: pending received emails with retry_count < 3, oldest first. */
  listPendingReceived(limit: number): Promise<string[]>;
  /** Context matching: did we send an email for this request to this address? */
  hasSentToAddress(requestId: string, address: string): Promise<boolean>;
  /** Webhook fallback: which user sent from this platform address? */
  findSenderUserId(fromEmail: string): Promise<string | null>;
}

const UNIQUE_VIOLATION = '23505';

export class SupabaseEmailsRepo implements EmailsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async getById(id: string): Promise<Email | null> {
    const { data, error } = await this.sb.from('emails').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Email | null) ?? null;
  }

  async insert(data: EmailInsert): Promise<InsertResult> {
    const { data: row, error } = await this.sb.from('emails').insert(data).select('*').single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { ok: false, duplicate: true };
      throw error;
    }
    return { ok: true, email: row as Email };
  }

  async update(id: string, patch: EmailPatch): Promise<void> {
    const { error } = await this.sb.from('emails').update(patch).eq('id', id);
    if (error) throw error;
  }

  async findIdByMessageId(messageId: string): Promise<string | null> {
    const { data, error } = await this.sb.from('emails').select('id').eq('message_id', messageId).limit(1);
    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async getRequestIdOfEmail(emailId: string): Promise<string | null> {
    const { data, error } = await this.sb.from('emails').select('request_id').eq('id', emailId).maybeSingle();
    if (error) throw error;
    return data?.request_id ?? null;
  }

  async listPendingReceived(limit: number): Promise<string[]> {
    const { data, error } = await this.sb
      .from('emails')
      .select('id')
      .eq('type', 'received')
      .eq('processing_status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  }

  async hasSentToAddress(requestId: string, address: string): Promise<boolean> {
    const { data, error } = await this.sb
      .from('emails')
      .select('id')
      .eq('request_id', requestId)
      .eq('type', 'sent')
      .ilike('to_email', `%${address}%`)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async findSenderUserId(fromEmail: string): Promise<string | null> {
    const { data, error } = await this.sb
      .from('emails')
      .select('user_id')
      .eq('from_email', fromEmail)
      .eq('type', 'sent')
      .limit(1);
    if (error) throw error;
    return data?.[0]?.user_id ?? null;
  }
}
