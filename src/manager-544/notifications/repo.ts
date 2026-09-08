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

export interface NotificationsRepo {
  /** Profiles with notification_email = true that still have an auth email. */
  listOptedInUsers(): Promise<OptedInUser[]>;
  /** A user's requests with status != 'answered'. */
  listOpenRequests(userId: string): Promise<Request[]>;
  /** (request, kind) pairs already notified to this user on `dateIso` (YYYY-MM-DD). */
  listSentToday(userId: string, dateIso: string): Promise<SentEntry[]>;
  /** Record the pairs as notified on `dateIso`; duplicates are ignored. */
  markSent(userId: string, entries: SentEntry[], dateIso: string): Promise<void>;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  notification_deadline_days: number;
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
