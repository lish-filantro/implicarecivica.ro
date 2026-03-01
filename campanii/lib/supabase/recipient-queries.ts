import type { CampaignRecipient } from "@/lib/types/campaign";
import { createServiceClient } from "./service";

export async function getRecipientsByCampaign(
  campaignId: string
): Promise<CampaignRecipient[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name");

  if (error) return [];
  return data as CampaignRecipient[];
}

export async function getActiveRecipientsByCampaign(
  campaignId: string
): Promise<CampaignRecipient[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("name");

  if (error) return [];
  return data as CampaignRecipient[];
}

export async function addRecipient(
  recipient: Omit<CampaignRecipient, "id" | "created_at">
): Promise<CampaignRecipient | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_recipients")
    .insert(recipient)
    .select()
    .single();

  if (error) return null;
  return data as CampaignRecipient;
}

export async function addRecipientsBulk(
  recipients: Omit<CampaignRecipient, "id" | "created_at">[]
): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaign_recipients")
    .insert(recipients)
    .select("id");

  if (error) {
    console.error("Bulk insert recipients error:", error);
    return 0;
  }
  return data?.length ?? 0;
}

export async function updateRecipient(
  id: string,
  updates: Partial<CampaignRecipient>
): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("campaign_recipients")
    .update(updates)
    .eq("id", id);

  return !error;
}

export async function deleteRecipient(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("campaign_recipients")
    .delete()
    .eq("id", id);

  return !error;
}
