import { NextResponse } from "next/server";
import { verifyDashboardAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const isAdmin = await verifyDashboardAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // All queries run in parallel — aggregate only, no personal data
  const [
    totalUsersRes,
    newUsers7dRes,
    newUsers30dRes,
    dailySignupsRes,
    requests30dRes,
    sessions30dRes,
    messages30dRes,
    feedback30dRes,
    campaignsActiveRes,
    requestStatusRes,
    feedbackStatusRes,
    topInstitutionsRes,
    activeUsers30dRes,
  ] = await Promise.all([
    // Total users
    supabase.from("profiles").select("*", { count: "exact", head: true }),

    // New users last 7 days
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),

    // New users last 30 days
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),

    // Daily signups (last 30 days) — fetch created_at only
    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: true }),

    // Requests last 30 days
    supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),

    // Sessions last 30 days
    supabase
      .from("request_sessions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),

    // Messages last 30 days
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),

    // Feedback last 30 days
    supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),

    // Active campaigns
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    // Request status distribution
    supabase.from("requests").select("status"),

    // Feedback status distribution
    supabase.from("feedback").select("status"),

    // Top institutions (institution_name + status from requests)
    supabase.from("requests").select("institution_name, status"),

    // Active users (distinct user_ids with activity in last 30 days)
    supabase
      .from("requests")
      .select("user_id")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  // Aggregate daily signups into { day: count }
  const dailySignups: Record<string, number> = {};
  if (dailySignupsRes.data) {
    for (const row of dailySignupsRes.data) {
      const day = new Date(row.created_at).toISOString().split("T")[0];
      dailySignups[day] = (dailySignups[day] || 0) + 1;
    }
  }

  // Fill in missing days
  const dailySignupsArray: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().split("T")[0];
    dailySignupsArray.push({ day: key, count: dailySignups[key] || 0 });
  }

  // Aggregate request status distribution
  const requestStatusDist: Record<string, number> = {};
  if (requestStatusRes.data) {
    for (const row of requestStatusRes.data) {
      const s = row.status || "unknown";
      requestStatusDist[s] = (requestStatusDist[s] || 0) + 1;
    }
  }

  // Aggregate feedback status distribution
  const feedbackStatusDist: Record<string, number> = {};
  if (feedbackStatusRes.data) {
    for (const row of feedbackStatusRes.data) {
      const s = row.status || "unknown";
      feedbackStatusDist[s] = (feedbackStatusDist[s] || 0) + 1;
    }
  }

  // Aggregate top institutions
  const institutionMap: Record<string, { total: number; answered: number }> = {};
  if (topInstitutionsRes.data) {
    for (const row of topInstitutionsRes.data) {
      const name = row.institution_name || "Necunoscută";
      if (!institutionMap[name]) {
        institutionMap[name] = { total: 0, answered: 0 };
      }
      institutionMap[name].total += 1;
      if (row.status === "answered") {
        institutionMap[name].answered += 1;
      }
    }
  }
  const topInstitutions = Object.entries(institutionMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // Count distinct active users
  const activeUserIds = new Set<string>();
  if (activeUsers30dRes.data) {
    for (const row of activeUsers30dRes.data) {
      if (row.user_id) activeUserIds.add(row.user_id);
    }
  }

  return NextResponse.json({
    users: {
      total: totalUsersRes.count ?? 0,
      new_7d: newUsers7dRes.count ?? 0,
      new_30d: newUsers30dRes.count ?? 0,
      active_30d: activeUserIds.size,
    },
    dailySignups: dailySignupsArray,
    activity: {
      requests_30d: requests30dRes.count ?? 0,
      sessions_30d: sessions30dRes.count ?? 0,
      messages_30d: messages30dRes.count ?? 0,
      feedback_30d: feedback30dRes.count ?? 0,
      campaigns_active: campaignsActiveRes.count ?? 0,
    },
    requestStatus: requestStatusDist,
    feedbackStatus: feedbackStatusDist,
    topInstitutions,
  });
}
