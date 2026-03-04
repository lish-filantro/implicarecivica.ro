import type { CampaignMessage } from "@/lib/campanii/types/campaign-message";
import { createServiceClient } from "@/lib/supabase/service";

export async function getCampaignMessages(
  campaignId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ messages: CampaignMessage[]; total: number }> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;
  const supabase = createServiceClient();

  let query = supabase
    .from("campaign_messages")
    .select("*", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("Get campaign messages error:", error);
    return { messages: [], total: 0 };
  }

  return { messages: (data as CampaignMessage[]) || [], total: count || 0 };
}

export async function getUnreadCount(campaignId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("campaign_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_read", false);

  if (error) return 0;
  return count || 0;
}

export async function markMessagesAsRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const supabase = createServiceClient();
  await supabase
    .from("campaign_messages")
    .update({ is_read: true })
    .in("id", messageIds);
}
