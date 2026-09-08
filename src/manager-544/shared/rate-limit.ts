/**
 * Daily per-institution sending limit: at most DAILY_LIMIT requests per user
 * per institution per calendar day. Single implementation shared by the
 * session creation, add-requests, send and rate-limit-check routes.
 *
 * The institution key is the institution email (normalized); when a request
 * has no email the institution name is used instead, so the limit always applies.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const DAILY_LIMIT = 10;

export interface SentCounter {
  /** Requests sent today by this user to this institution key. */
  countSentToday(userId: string, institutionKey: string, sinceIso: string): Promise<number>;
}

export interface DailyLimitStatus {
  ok: boolean;
  sent_today: number;
  remaining: number;
  limit: number;
}

export type InstitutionRef = string | { email: string | null | undefined; name: string };

export function institutionKey(ref: InstitutionRef): string {
  if (typeof ref === 'string') return ref.trim().toLowerCase();
  const email = ref.email?.trim().toLowerCase();
  return email || `name:${ref.name.trim().toLowerCase()}`;
}

/** Local midnight of `now` as ISO (matches the legacy `setHours(0,0,0,0)` behaviour). */
export function startOfToday(now: () => Date = () => new Date()): string {
  const d = new Date(now().getTime());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function checkDailyLimit(
  userId: string,
  institution: InstitutionRef,
  requested: number,
  counter: SentCounter,
  now: () => Date = () => new Date(),
): Promise<DailyLimitStatus> {
  const sentToday = await counter.countSentToday(userId, institutionKey(institution), startOfToday(now));
  const remaining = Math.max(0, DAILY_LIMIT - sentToday);
  return { ok: requested <= remaining, sent_today: sentToday, remaining, limit: DAILY_LIMIT };
}

/** Counts `requests` rows with date_sent >= since for the user + institution (email or name key). */
export class SupabaseSentCounter implements SentCounter {
  constructor(private readonly sb: SupabaseClient) {}

  async countSentToday(userId: string, key: string, sinceIso: string): Promise<number> {
    let query = this.sb
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date_sent', sinceIso);
    query = key.startsWith('name:')
      ? query.is('institution_email', null).ilike('institution_name', key.slice('name:'.length))
      : query.ilike('institution_email', key);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }
}
