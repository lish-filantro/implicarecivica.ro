import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/campanii/admin-auth";
import { getCampaignBySlug } from "@/lib/campanii/campaign-queries";
import {
  getParticipationsByCampaign,
  getParticipationStats,
} from "@/lib/campanii/participation-queries";

export async function GET(
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

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const [participationsResult, stats] = await Promise.all([
    getParticipationsByCampaign(campaign.id, limit, offset),
    getParticipationStats(campaign.id),
  ]);

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      status: campaign.status,
      participation_count: campaign.participation_count,
      confirmed_count: campaign.confirmed_count,
      created_at: campaign.created_at,
    },
    participations: participationsResult.participations,
    total: participationsResult.total,
    stats,
  });
}
