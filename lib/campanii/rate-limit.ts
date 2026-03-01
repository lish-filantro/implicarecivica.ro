import { createServiceClient } from "@/lib/supabase/service";

const MAX_PARTICIPATIONS_PER_IP = 3;
const WINDOW_HOURS = 24;

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
    return { allowed: true, count: 0 };
  }

  const count = data as number;
  return { allowed: count < MAX_PARTICIPATIONS_PER_IP, count };
}
