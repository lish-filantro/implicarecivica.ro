import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getAllCampaigns,
  createCampaign,
  checkEmailSubjectUnique,
} from "@/lib/supabase/campaign-queries";
import { campaignSchema } from "@/lib/validations/campaign";

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "draft" | "active" | "archived" | null;

  if (!isAdmin) {
    // Public: only active campaigns
    const campaigns = await getAllCampaigns("active");
    return NextResponse.json(campaigns);
  }

  // Admin: all campaigns, optionally filtered
  const campaigns = await getAllCampaigns(status || undefined);
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = campaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check email subject uniqueness if status is active
    if (parsed.data.status === "active") {
      const isUnique = await checkEmailSubjectUnique(parsed.data.email_subject);
      if (!isUnique) {
        return NextResponse.json(
          { error: "Subiectul emailului există deja la o campanie activă" },
          { status: 409 }
        );
      }
    }

    const campaign = await createCampaign(parsed.data as Parameters<typeof createCampaign>[0]);
    if (!campaign) {
      return NextResponse.json({ error: "Eroare la creare" }, { status: 500 });
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
