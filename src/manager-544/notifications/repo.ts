/**
 * Data access for the deadline digest. Runs on the service-role client: the
 * cron reads every opted-in profile, needs auth.admin for login emails and
 * writes `deadline_notifications` (no RLS policies, service role only).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from '@m544/shared/types/request';
import type { NoticeKind } from './select';

export interface OptedInUser {
  userId: string;
  email: string;
  displayName: string | null;
  /** profiles.notification_deadline_days */
  deadlineDays: number;
}

export interface SentEntry {
  requestId: string;
  kind: NoticeKind;
}

/** A received email the pipeline could not attribute, waiting in "De revizuit". */
export interface ReviewNotice {
  emailId: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
}

export interface NotificationsRepo {
  /** Profiles with notification_email = true that still have an auth email. */
  listOptedInUsers(): Promise<OptedInUser[]>;
  /** A user's requests with status != 'answered'. */
  listOpenRequests(userId: string): Promise<Request[]>;
  /** (request, kind) pairs already notified to this user on `dateIso` (YYYY-MM-DD). */
  listSentToday(userId: string, dateIso: string): Promise<SentEntry[]>;
  /** Record the pairs as notified on `dateIso`; duplicates are ignored. */
  markSent(userId: string, entries: SentEntry[], dateIso: string): Promise<void>;
  /**
   * Emails flagged for review that arrived at or after `sinceIso`. The arrival
   * window IS the deduplication: there is no per-email sent-log, so an email is
   * mentioned by the digest of the day it landed and not nagged about again.
   */
  listEmailsNeedingReview(userId: string, sinceIso: string): Promise<ReviewNotice[]>;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  notification_deadline_days: number;
}

interface ReviewRow {
  id: string;
  from_email: string;
  subject: string;
  received_at: string | null;
  created_at: string;
}

interface SentRow {
  request_id: string;
  kind: NoticeKind;
}

export class SupabaseNotificationsRepo implements NotificationsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async listOptedInUsers(): Promise<OptedInUser[]> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('id, display_name, notification_deadline_days')
      .eq('notification_email', true);
    if (error) throw error;
    const rows = (data ?? []) as ProfileRow[];
    const users = await Promise.all(
      rows.map(async (p): Promise<OptedInUser | null> => {
        const { data: auth } = await this.sb.auth.admin.getUserById(p.id);
        const email = auth?.user?.email;
        if (!email) return null;
        return { userId: p.id, email, displayName: p.display_name, deadlineDays: p.notification_deadline_days };
      }),
    );
    return users.filter((u): u is OptedInUser => u !== null);
  }

  async listOpenRequests(userId: string): Promise<Request[]> {
    const { data, error } = await this.sb
      .from('requests')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'answered')
      .order('date_initiated', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Request[];
  }

  async listEmailsNeedingReview(userId: string, sinceIso: string): Promise<ReviewNotice[]> {
    const { data, error } = await this.sb
      .from('emails')
      .select('id, from_email, subject, received_at, created_at')
      .eq('user_id', userId)
      .eq('type', 'received')
      .eq('needs_review', true)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ReviewRow[]).map((r) => ({
      emailId: r.id,
      fromEmail: r.from_email,
      subject: r.subject,
      receivedAt: r.received_at ?? r.created_at,
    }));
  }

  async listSentToday(userId: string, dateIso: string): Promise<SentEntry[]> {
    const { data, error } = await this.sb
      .from('deadline_notifications')
      .select('request_id, kind')
      .eq('user_id', userId)
      .eq('sent_on', dateIso);
    if (error) throw error;
    return ((data ?? []) as SentRow[]).map((r) => ({ requestId: r.request_id, kind: r.kind }));
  }

  async markSent(userId: string, entries: SentEntry[], dateIso: string): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((e) => ({ user_id: userId, request_id: e.requestId, kind: e.kind, sent_on: dateIso }));
    const { error } = await this.sb
      .from('deadline_notifications')
      .upsert(rows, { onConflict: 'user_id,request_id,kind,sent_on', ignoreDuplicates: true });
    if (error) throw error;
  }
}
