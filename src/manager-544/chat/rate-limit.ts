/**
 * Daily chat quota: at most CHAT_DAILY_LIMIT user messages per user per UTC
 * day. Checked by the handler after the cheap guards and before the model is
 * called, so a blocked request costs no Anthropic tokens.
 *
 * Usage is read from the `messages` table the chat UI already writes
 * (sender = 'user'), joined through `conversations` to the caller. With the
 * session client RLS restricts the count to the caller's own conversations.
 * Note: the UI saves the user message concurrently with the API call, so the
 * current message may or may not be counted — the effective limit is 59–60.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const CHAT_DAILY_LIMIT = 60;

export interface ChatUsageCounter {
  /** User messages sent by `userId` since the start of the UTC day containing `now`. */
  countToday(userId: string, now: Date): Promise<number>;
}

export type ChatLimitStatus = { ok: true; used: number } | { ok: false; used: number; limit: number };

/** Midnight UTC of the given instant, as ISO. */
export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function checkChatLimit(userId: string, counter: ChatUsageCounter, now: Date = new Date()): Promise<ChatLimitStatus> {
  const used = await counter.countToday(userId, now);
  return used < CHAT_DAILY_LIMIT ? { ok: true, used } : { ok: false, used, limit: CHAT_DAILY_LIMIT };
}

/** Head count on `messages` for the caller's conversations (client created per call: it is cookie-bound). */
export class SupabaseChatUsageCounter implements ChatUsageCounter {
  constructor(private readonly getClient: () => Promise<SupabaseClient>) {}

  async countToday(userId: string, now: Date): Promise<number> {
    const sb = await this.getClient();
    const { count, error } = await sb
      .from('messages')
      .select('id, conversations!inner(user_id)', { count: 'exact', head: true })
      .eq('sender', 'user')
      .gte('created_at', startOfUtcDay(now))
      .eq('conversations.user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }
}
