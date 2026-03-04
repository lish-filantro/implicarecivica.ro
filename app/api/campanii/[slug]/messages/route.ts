import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/campanii/admin-auth";
import { getCampaignBySlug } from "@/lib/campanii/campaign-queries";
import {
  getCampaignMessages,
  markMessagesAsRead,
  getUnreadCount,
} from "@/lib/campanii/message-queries";

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
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const unreadOnly = searchParams.get("unread_only") === "true";

  const { messages, total } = await getCampaignMessages(campaign.id, {
    limit,
    offset,
    unreadOnly,
  });
  const unreadCount = await getUnreadCount(campaign.id);

  return NextResponse.json({ messages, total, unread_count: unreadCount });
}

export async function PATCH(
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
    const { message_ids } = await request.json();
    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return NextResponse.json({ error: "message_ids required" }, { status: 400 });
    }

    await markMessagesAsRead(message_ids);
    return NextResponse.json({ marked: message_ids.length });
  } catch {
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}
