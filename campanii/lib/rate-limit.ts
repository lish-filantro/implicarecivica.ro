import { createServiceClient } from "./supabase/service";

const MAX_PARTICIPATIONS_PER_IP = 3;
const WINDOW_HOURS = 24;

/**
 * Checks if an IP hash has exceeded the rate limit for a campaign.
 * Uses a Supabase RPC function for serverless-safe rate limiting.
 */
export async function checkRateLimit(
  campaignId: string,
  ipHash: string
): Promise<{ allowed: boolean; count: number }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("check_campaign_rate_limit", {
    p_campaign_id: campaignId,
    p_ip_hash: ipHash,
    p_window_hours: WINDOW_HOURS,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    // Fail open — don't block users if check fails
    return { allowed: true, count: 0 };
  }

  const count = data as number;
  return { allowed: count < MAX_PARTICIPATIONS_PER_IP, count };
}
