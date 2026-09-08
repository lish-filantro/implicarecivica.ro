/**
 * Read access to the request rows behind the public institution statistics.
 * Runs on the service-role client (cross-user aggregate) but selects only the
 * six status/date columns — no subject, body or user id ever leaves the DB.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StatRow } from './aggregate';

export interface StatsQuery {
  /** Short institution name (matched with ilike %nume%). */
  nume?: string;
  /** Curated institution slug (matched against requests.institution_id). */
  slug?: string;
}

export interface PublicStatsRepo {
  listRows(query: StatsQuery): Promise<StatRow[]>;
}

export const STAT_COLUMNS = 'status,date_sent,date_received,response_received_date,deadline_date,extension_date';
export const MAX_FILTER_LENGTH = 100;
/** A shorter name would match almost every institution (ilike %ab%). */
export const MIN_NAME_LENGTH = 3;

/** Characters that PostgREST reads as filter syntax inside an `or` expression or a like pattern. */
const FILTER_SYNTAX = /[%,()*]/g;

/** Strip filter syntax, collapse whitespace and cap the length so user input can be interpolated. */
export function sanitizeFilterValue(value: string): string {
  return value.replace(FILTER_SYNTAX, '').replace(/\s+/g, ' ').trim().slice(0, MAX_FILTER_LENGTH);
}

/** PostgREST `or` expression for a query, or null when neither parameter survives sanitising. */
export function buildOrFilter(query: StatsQuery): string | null {
  const parts: string[] = [];
  const slug = query.slug ? sanitizeFilterValue(query.slug) : '';
  const nume = query.nume ? sanitizeFilterValue(query.nume) : '';
  if (slug) parts.push(`institution_id.eq.${slug}`);
  if (nume.length >= MIN_NAME_LENGTH) parts.push(`institution_name.ilike.%${nume}%`);
  return parts.length > 0 ? parts.join(',') : null;
}

export class SupabasePublicStatsRepo implements PublicStatsRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async listRows(query: StatsQuery): Promise<StatRow[]> {
    const filter = buildOrFilter(query);
    if (!filter) return [];
    const { data, error } = await this.sb.from('requests').select(STAT_COLUMNS).or(filter);
    if (error) throw error;
    return (data ?? []) as unknown as StatRow[];
  }
}
