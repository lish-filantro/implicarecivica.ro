/**
 * Manual account approval: list users waiting for approval, approve one,
 * or reject one (deletes the auth user; the profile row cascades).
 */

export interface PendingProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  created_at: string;
}

export interface PendingUser extends PendingProfile {
  email: string | null;
}

/** Profiles table + auth.admin, as needed by the approval flow. */
export interface AdminUsersRepo {
  /** Unapproved profiles, newest first. */
  listUnapprovedProfiles(): Promise<PendingProfile[]>;
  /** Email from auth.users, or null when the auth user no longer exists. */
  getAuthEmail(id: string): Promise<string | null>;
  setApproved(id: string, approved: boolean): Promise<void>;
  deleteAuthUser(id: string): Promise<void>;
}

export async function listPendingUsers(repo: AdminUsersRepo): Promise<PendingUser[]> {
  const profiles = await repo.listUnapprovedProfiles();
  if (profiles.length === 0) return [];
  return Promise.all(
    profiles.map(async (p) => ({
      id: p.id,
      email: await repo.getAuthEmail(p.id),
      first_name: p.first_name,
      last_name: p.last_name,
      display_name: p.display_name,
      created_at: p.created_at,
    })),
  );
}

export function approveUser(repo: AdminUsersRepo, userId: string): Promise<void> {
  return repo.setApproved(userId, true);
}

export function rejectUser(repo: AdminUsersRepo, userId: string): Promise<void> {
  return repo.deleteAuthUser(userId);
}
