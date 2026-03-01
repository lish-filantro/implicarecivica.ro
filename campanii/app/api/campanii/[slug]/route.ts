import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getCampaignBySlug,
  updateCampaign,
  checkEmailSubjectUnique,
} from "@/lib/supabase/campaign-queries";
import { campaignSchema } from "@/lib/validations/campaign";
import type { Campaign } from "@/lib/types/campaign";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);

  if (!campaign) {
    return NextResponse.json({ error: "Campanie negăsită" }, { status: 404 });
  }

  const isAdmin = await verifyAdminSession();
  if (!isAdmin && campaign.status !== "active") {
    return NextResponse.json({ error: "Campanie negăsită" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ error: "Campanie negăsită" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = campaignSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check subject uniqueness if changing it
    if (parsed.data.email_subject && parsed.data.email_subject !== campaign.email_subject) {
      const targetStatus = parsed.data.status || campaign.status;
      if (targetStatus === "active") {
        const isUnique = await checkEmailSubjectUnique(parsed.data.email_subject, campaign.id);
        if (!isUnique) {
          return NextResponse.json(
            { error: "Subiectul emailului există deja la o campanie activă" },
            { status: 409 }
          );
        }
      }
    }

    const updated = await updateCampaign(campaign.id, parsed.data as Partial<Campaign>);
    if (!updated) {
      return NextResponse.json({ error: "Eroare la actualizare" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
