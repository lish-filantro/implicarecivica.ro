import type { Campaign, CampaignStatus } from "@/lib/types/campaign";
import { createServiceClient } from "./service";

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data as Campaign;
}

export async function getActiveCampaignBySlug(slug: string): Promise<Campaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error) return null;
  return data as Campaign;
}

export async function getActiveCampaigns(): Promise<Campaign[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as Campaign[];
}

export async function getAllCampaigns(status?: CampaignStatus): Promise<Campaign[]> {
  const supabase = createServiceClient();
  let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return [];
  return data as Campaign[];
}

export async function createCampaign(
  campaign: Omit<Campaign, "id" | "created_at" | "updated_at" | "participation_count" | "confirmed_count">
): Promise<Campaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) {
    console.error("Create campaign error:", error);
    return null;
  }
  return data as Campaign;
}

export async function updateCampaign(
  id: string,
  updates: Partial<Campaign>
): Promise<Campaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update campaign error:", error);
    return null;
  }
  return data as Campaign;
}

export async function checkEmailSubjectUnique(
  subject: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient();
  let query = supabase
    .from("campaigns")
    .select("id")
    .eq("email_subject", subject)
    .eq("status", "active");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query;
  return !data || data.length === 0;
}
