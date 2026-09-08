/**
 * Requests repository — queries on `requests` used by the processing pipeline
 * (status updates, matching, overdue check). Session/UI queries live in
 * requests/sessions.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request, RequestStatus } from '@m544/shared/types/request';

export type RequestPatch = Partial<
  Pick<
    Request,
    | 'status'
    | 'registration_number'
    | 'date_received'
    | 'deadline_date'
    | 'extension_date'
    | 'extension_days'
    | 'extension_reason'
    | 'response_received_date'
    | 'answer_summary'
    | 'redirected_to'
  >
>;

/** Compact view used by context matching. */
export interface OpenRequest {
  id: string;
  status: RequestStatus;
  subject: string;
  institution_name: string;
  institution_email: string | null;
  date_initiated: string;
  registration_number: string | null;
}

export interface RequestsRepo {
  getById(id: string): Promise<Request | null>;
  update(id: string, patch: RequestPatch): Promise<void>;
  /** Exact registration-number match for one user. */
  findByRegistrationNumber(userId: string, registrationNumber: string): Promise<string | null>;
  /** All of a user's requests that already carry a registration number (fuzzy/core matching). */
  listWithRegistration(userId: string): Promise<Array<{ id: string; registration_number: string }>>;
  /** A user's requests not yet answered, oldest first (context matching). */
  listOpen(userId: string): Promise<OpenRequest[]>;
  /** Not answered/delayed and effective deadline (extension_date ?? deadline_date) before `nowIso`. */
  listOverdueIds(nowIso: string): Promise<string[]>;
}

export class SupabaseRequestsRepo implements RequestsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async getById(id: string): Promise<Request | null> {
    const { data, error } = await this.sb.from('requests').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Request | null) ?? null;
  }

  async update(id: string, patch: RequestPatch): Promise<void> {
    const { error } = await this.sb.from('requests').update(patch).eq('id', id);
    if (error) throw error;
  }

  async findByRegistrationNumber(userId: string, registrationNumber: string): Promise<string | null> {
    const { data, error } = await this.sb
      .from('requests')
      .select('id')
      .eq('user_id', userId)
      .eq('registration_number', registrationNumber)
      .limit(1);
    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async listWithRegistration(userId: string): Promise<Array<{ id: string; registration_number: string }>> {
    const { data, error } = await this.sb
      .from('requests')
      .select('id, registration_number')
      .eq('user_id', userId)
      .not('registration_number', 'is', null);
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; registration_number: string }>;
  }

  async listOpen(userId: string): Promise<OpenRequest[]> {
    const { data, error } = await this.sb
      .from('requests')
      .select('id, status, subject, institution_name, institution_email, date_initiated, registration_number')
      .eq('user_id', userId)
      .neq('status', 'answered')
      .order('date_initiated', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OpenRequest[];
  }

  async listOverdueIds(nowIso: string): Promise<string[]> {
    // Effective deadline = extension_date when present, else deadline_date.
    // Two indexed predicates instead of a COALESCE the planner cannot index.
    const [byExtension, byDeadline] = await Promise.all([
      this.sb
        .from('requests')
        .select('id')
        .not('status', 'in', '("answered","delayed")')
        .lt('extension_date', nowIso),
      this.sb
        .from('requests')
        .select('id')
        .not('status', 'in', '("answered","delayed")')
        .is('extension_date', null)
        .lt('deadline_date', nowIso),
    ]);
    if (byExtension.error) throw byExtension.error;
    if (byDeadline.error) throw byDeadline.error;
    const ids = new Set<string>([...(byExtension.data ?? []), ...(byDeadline.data ?? [])].map((r) => r.id as string));
    return [...ids];
  }
}
