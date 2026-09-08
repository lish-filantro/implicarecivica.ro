/**
 * Supabase implementations of the admin repositories. Both run on the
 * service-role client: the stats need cross-user aggregates and the approval
 * flow needs auth.admin. Never expose these to the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminStatsRepo,
  CountedTable,
  CreatedAtRow,
  EmailProcessingStatus,
  InstitutionRow,
  StatusRow,
  UserIdRow,
} from './stats';
import type { AdminUsersRepo, PendingProfile } from './users';

type Filter = { column: string; op: 'gte' | 'eq'; value: string | boolean };

const RECEIVED: Filter = { column: 'type', op: 'eq', value: 'received' };

export class SupabaseAdminStatsRepo implements AdminStatsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  private async count(table: string, ...filters: Filter[]): Promise<number> {
    let q = this.sb.from(table).select('*', { count: 'exact', head: true });
    for (const f of filters) q = f.op === 'gte' ? q.gte(f.column, f.value) : q.eq(f.column, f.value);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }

  private async rows<T>(table: string, columns: string, filter?: Filter, orderBy?: string): Promise<T[]> {
    let q = this.sb.from(table).select(columns);
    if (filter) q = filter.op === 'gte' ? q.gte(filter.column, filter.value) : q.eq(filter.column, filter.value);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as T[];
  }

  countProfiles(since?: string) {
    return since ? this.count('profiles', { column: 'created_at', op: 'gte', value: since }) : this.count('profiles');
  }
  countPendingProfiles() {
    return this.count('profiles', { column: 'approved', op: 'eq', value: false });
  }
  profileSignupsSince(since: string) {
    return this.rows<CreatedAtRow>('profiles', 'created_at', { column: 'created_at', op: 'gte', value: since }, 'created_at');
  }
  countSince(table: CountedTable, since: string) {
    return this.count(table, { column: 'created_at', op: 'gte', value: since });
  }
  countActiveCampaigns() {
    return this.count('campaigns', { column: 'status', op: 'eq', value: 'active' });
  }
  requestStatuses() {
    return this.rows<StatusRow>('requests', 'status');
  }
  feedbackStatuses() {
    return this.rows<StatusRow>('feedback', 'status');
  }
  requestInstitutions() {
    return this.rows<InstitutionRow>('requests', 'institution_name, status');
  }
  activeUserIdsSince(since: string) {
    return this.rows<UserIdRow>('requests', 'user_id', { column: 'created_at', op: 'gte', value: since });
  }
  countReceivedEmails(status: EmailProcessingStatus) {
    return this.count('emails', RECEIVED, { column: 'processing_status', op: 'eq', value: status });
  }
  countEmailsNeedingReview() {
    return this.count('emails', RECEIVED, { column: 'needs_review', op: 'eq', value: true });
  }
  async lastInboundAt(): Promise<string | null> {
    const { data, error } = await this.sb
      .from('emails')
      .select('received_at')
      .eq('type', 'received')
      .not('received_at', 'is', null)
      .order('received_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as { received_at?: string | null } | undefined)?.received_at ?? null;
  }
}

export class SupabaseAdminUsersRepo implements AdminUsersRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async listUnapprovedProfiles(): Promise<PendingProfile[]> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('id, first_name, last_name, display_name, created_at')
      .eq('approved', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PendingProfile[];
  }

  async getAuthEmail(id: string): Promise<string | null> {
    const { data } = await this.sb.auth.admin.getUserById(id);
    return data?.user?.email ?? null;
  }

  async setApproved(id: string, approved: boolean): Promise<void> {
    const { error } = await this.sb.from('profiles').update({ approved }).eq('id', id);
    if (error) throw error;
  }

  async deleteAuthUser(id: string): Promise<void> {
    const { error } = await this.sb.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
