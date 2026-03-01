import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { confirmParticipation } from "@/lib/campanii/participation-queries";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.CLOUDFLARE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subject, from } = await request.json();

    if (!subject) {
      return NextResponse.json({ error: "Subject required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("email_subject", subject)
      .eq("status", "active")
      .single();

    if (!campaign) {
      const cleanSubject = subject
        .replace(/^(Re|Fwd|FW|RE):\s*/gi, "")
        .trim();

      const { data: fallbackCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("email_subject", cleanSubject)
        .eq("status", "active")
        .single();

      if (!fallbackCampaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      await confirmParticipation(fallbackCampaign.id, from);
      return NextResponse.json({ confirmed: true, campaign_id: fallbackCampaign.id });
    }

    await confirmParticipation(campaign.id, from);
    return NextResponse.json({ confirmed: true, campaign_id: campaign.id });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
