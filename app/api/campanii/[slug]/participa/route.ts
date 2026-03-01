import { NextRequest, NextResponse } from "next/server";
import { getActiveCampaignBySlug } from "@/lib/campanii/campaign-queries";
import { getActiveRecipientsByCampaign } from "@/lib/campanii/recipient-queries";
import { createParticipation } from "@/lib/campanii/participation-queries";
import { participationSchema } from "@/lib/campanii/validations/participation";
import { hashIP, hashUserAgent } from "@/lib/campanii/ip-hash";
import { checkRateLimit } from "@/lib/campanii/rate-limit";
import { renderEmailBody } from "@/lib/campanii/mailto";
import { formatDate } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const campaign = await getActiveCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: "Campanie negăsită sau inactivă" }, { status: 404 });
  }

  if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
    return NextResponse.json({ error: "Campania a expirat" }, { status: 410 });
  }

  const body = await request.json();
  const parsed = participationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Date invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = hashIP(ip);
  const ua = request.headers.get("user-agent") || "";
  const uaHash = hashUserAgent(ua);

  const { allowed } = await checkRateLimit(campaign.id, ipHash);
  if (!allowed) {
    return NextResponse.json(
      { error: "Ai atins limita de participări. Încearcă mai târziu." },
      { status: 429 }
    );
  }

  const participation = await createParticipation({
    campaign_id: campaign.id,
    participant_name: parsed.data.participant_name,
    participant_email: parsed.data.participant_email,
    participant_city: parsed.data.participant_city || null,
    custom_field_value: parsed.data.custom_field_value || null,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    email_status: "pending",
  });

  if (!participation) {
    return NextResponse.json({ error: "Eroare la înregistrare" }, { status: 500 });
  }

  const recipients = await getActiveRecipientsByCampaign(campaign.id);

  const renderedBody = renderEmailBody(campaign.email_body, {
    nume_participant: parsed.data.participant_name,
    oras_participant: parsed.data.participant_city,
    data: formatDate(new Date()),
    organizatie: campaign.organization || undefined,
  });

  const fullBody = campaign.email_signature
    ? `${renderedBody}\n\n${campaign.email_signature}`
    : renderedBody;

  return NextResponse.json({
    success: true,
    participationId: participation.id,
    emailData: {
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
      subject: campaign.email_subject,
      body: fullBody,
    },
    campaign: {
      success_message: campaign.success_message,
      redirect_url: campaign.redirect_url,
      participation_count: campaign.participation_count + 1,
    },
  });
}
