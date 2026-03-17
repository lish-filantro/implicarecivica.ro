import { createClient } from "@/lib/supabase/server";

const DEFAULT_ADMIN_EMAILS = ["lishhop@protonmail.com"];

function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(",").map((e) => e.trim().toLowerCase());
  }
  return DEFAULT_ADMIN_EMAILS;
}

export async function verifyDashboardAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.email) return false;
    return getAdminEmails().includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}
