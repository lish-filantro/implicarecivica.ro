import { createClient } from "@/lib/supabase/server";

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    return !authError && !!user;
  } catch {
    return false;
  }
}

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
