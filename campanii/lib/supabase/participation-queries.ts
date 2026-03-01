import type { CampaignParticipation } from "@/lib/types/campaign";
import { createServiceClient } from "./service";

export async function createParticipation(
  participation: Omit<CampaignParticipation, "id" | "confirmed_at" | "created_at">
): Promise<CampaignParticipation | null> {
  const supabase = createServiceClient();

  // Insert participation
  const { data, error } = await supabase
    .from("campaign_participations")
    .insert(participation)
    .select()
    .single();

  if (error) {
    console.error("Create participation error:", error);
    return null;
  }

  // Increment optimistic counter
  await supabase.rpc("increment_campaign_participation", {
    p_campaign_id: participation.campaign_id,
    p_counter: "participation",
  });

  return data as CampaignParticipation;
}

export async function confirmParticipation(
  campaignId: string,
  participantEmail?: string
): Promise<boolean> {
  const supabase = createServiceClient();

  // Find the most recent pending participation for this campaign
  let query = supabase
    .from("campaign_participations")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("email_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (participantEmail) {
    query = query.eq("participant_email", participantEmail);
  }

  const { data: participation } = await query.single();
  if (!participation) return false;

  // Mark as confirmed
  const { error } = await supabase
    .from("campaign_participations")
    .update({
      email_status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", participation.id);

  if (error) return false;

  // Increment confirmed counter
  await supabase.rpc("increment_campaign_participation", {
    p_campaign_id: campaignId,
    p_counter: "confirmed",
  });

  return true;
}

export async function getParticipationsByCampaign(
  campaignId: string,
  limit = 50,
  offset = 0
): Promise<{ participations: CampaignParticipation[]; total: number }> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("campaign_participations")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const { data, error } = await supabase
    .from("campaign_participations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { participations: [], total: 0 };

  return {
    participations: data as CampaignParticipation[],
    total: count ?? 0,
  };
}

export async function getParticipationStats(campaignId: string) {
  const supabase = createServiceClient();

  // Daily participation counts for the last 30 days
  const { data: daily } = await supabase
    .from("campaign_participations")
    .select("created_at")
    .eq("campaign_id", campaignId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at");

  // City breakdown
  const { data: cities } = await supabase
    .from("campaign_participations")
    .select("participant_city")
    .eq("campaign_id", campaignId)
    .not("participant_city", "is", null);

  // Group daily data
  const dailyCounts: Record<string, number> = {};
  if (daily) {
    for (const p of daily) {
      const day = new Date(p.created_at).toISOString().split("T")[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }
  }

  // Group city data
  const cityCounts: Record<string, number> = {};
  if (cities) {
    for (const p of cities) {
      if (p.participant_city) {
        cityCounts[p.participant_city] = (cityCounts[p.participant_city] || 0) + 1;
      }
    }
  }

  return { dailyCounts, cityCounts };
}
