import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getCampaignBySlug } from "@/lib/supabase/campaign-queries";
import {
  getRecipientsByCampaign,
  addRecipient,
  addRecipientsBulk,
  updateRecipient,
  deleteRecipient,
} from "@/lib/supabase/recipient-queries";
import { recipientSchema } from "@/lib/validations/campaign";
import { parseCsvRecipients } from "@/lib/csv-parser";

export async function GET(
  _request: NextRequest,
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

  const recipients = await getRecipientsByCampaign(campaign.id);
  return NextResponse.json(recipients);
}

export async function POST(
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

  const body = await request.json();

  // Bulk import via CSV
  if (body.csv) {
    const { recipients, errors } = parseCsvRecipients(body.csv);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Niciun destinatar valid", errors }, { status: 400 });
    }

    const inserted = await addRecipientsBulk(
      recipients.map((r) => ({
        campaign_id: campaign.id,
        name: r.name,
        role: r.role || null,
        email: r.email,
        is_active: true,
      }))
    );

    return NextResponse.json({ inserted, errors }, { status: 201 });
  }

  // Single recipient
  const parsed = recipientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Date invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const recipient = await addRecipient({
    campaign_id: campaign.id,
    name: parsed.data.name,
    role: parsed.data.role || null,
    email: parsed.data.email,
    is_active: true,
  });

  if (!recipient) {
    return NextResponse.json({ error: "Eroare la adăugare" }, { status: 500 });
  }

  return NextResponse.json(recipient, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "ID lipsă" }, { status: 400 });
  }

  const success = await updateRecipient(id, updates);
  if (!success) {
    return NextResponse.json({ error: "Eroare la actualizare" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID lipsă" }, { status: 400 });
  }

  const success = await deleteRecipient(id);
  if (!success) {
    return NextResponse.json({ error: "Eroare la ștergere" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
