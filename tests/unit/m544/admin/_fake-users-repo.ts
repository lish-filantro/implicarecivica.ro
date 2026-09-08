import type { AdminUsersRepo, PendingProfile } from '@m544/admin/users';

type Seed = Partial<PendingProfile> & { id: string; approved: boolean; created_at: string; email: string | null };

export class FakeAdminUsersRepo implements AdminUsersRepo {
  profiles = new Map<string, PendingProfile & { approved: boolean }>();
  emails = new Map<string, string | null>();
  deletedAuthUsers: string[] = [];
  emailLookups = 0;
  failWith: Error | null = null;

  seed(s: Seed) {
    this.profiles.set(s.id, {
      id: s.id,
      first_name: s.first_name ?? null,
      last_name: s.last_name ?? null,
      display_name: s.display_name ?? null,
      created_at: s.created_at,
      approved: s.approved,
    });
    this.emails.set(s.id, s.email);
  }

  private check() {
    if (this.failWith) throw this.failWith;
  }

  async listUnapprovedProfiles(): Promise<PendingProfile[]> {
    this.check();
    return [...this.profiles.values()]
      .filter((p) => !p.approved)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ approved: _approved, ...p }) => p);
  }

  async getAuthEmail(id: string): Promise<string | null> {
    this.check();
    this.emailLookups++;
    return this.emails.get(id) ?? null;
  }

  async setApproved(id: string, approved: boolean): Promise<void> {
    this.check();
    const p = this.profiles.get(id);
    if (p) p.approved = approved;
  }

  async deleteAuthUser(id: string): Promise<void> {
    this.check();
    this.deletedAuthUsers.push(id);
    this.profiles.delete(id);
    this.emails.delete(id);
  }
}
