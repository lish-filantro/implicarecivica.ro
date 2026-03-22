import { NextResponse } from "next/server";
import { verifyDashboardAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const isAdmin = await verifyDashboardAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all unapproved profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get emails from auth.users for these profiles
  const userIds = profiles?.map((p) => p.id) || [];
  if (userIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  // Fetch auth users to get emails
  const usersWithEmail = await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await supabase.auth.admin.getUserById(uid);
      return { id: uid, email: data?.user?.email || null };
    })
  );

  const emailMap = new Map(usersWithEmail.map((u) => [u.id, u.email]));

  const users = (profiles || []).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) || null,
    first_name: p.first_name,
    last_name: p.last_name,
    display_name: p.display_name,
    created_at: p.created_at,
  }));

  return NextResponse.json({ users });
}
