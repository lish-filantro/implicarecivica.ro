/**
 * Institutions repository — verified Legea 544 addresses learned from the
 * answers institutions actually send (`institutii_locale`, migration 017).
 *
 * Written by the pipeline (service role) after a received email is matched to
 * a request; read by the chat `rag_search` tool so the model can reuse a
 * proven address instead of guessing one through web_search.
 *
 * Only institutional addresses are stored: an answer coming from a personal
 * mailbox (gmail, yahoo, …) is most likely a clerk forwarding from their own
 * account, and recording it would teach the chat to send requests to a person.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeInstitutionName } from '@m544/shared/utils/normalize-name';

export type InstitutionSource = 'raspuns' | 'manual';

export interface KnownInstitution {
  nume: string;
  email: string;
  verificat_la: string;
  nr_confirmari: number;
  sursa: InstitutionSource;
}

export interface RecordVerifiedEmailInput {
  name: string;
  email: string;
  source?: InstitutionSource;
  judet?: string | null;
  localitate?: string | null;
}

export interface InstitutionsRepo {
  /**
   * Upsert on the normalized name: same email → one more confirmation and a
   * fresh `verificat_la`; a different email replaces the old one and resets the
   * confirmation count to 1. Personal addresses and blank names are ignored.
   */
  recordVerifiedEmail(input: RecordVerifiedEmailInput): Promise<void>;
  /** Exact normalized-name match first; otherwise substring matches, at most `limit`. */
  findByName(name: string, limit?: number): Promise<KnownInstitution[]>;
}

export const DEFAULT_FIND_LIMIT = 5;

/** Personal mailbox providers: an institution never answers from these. */
const PERSONAL_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'yahoo.ro', 'hotmail.com', 'outlook.com', 'protonmail.com']);

export function isInstitutionalAddress(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return false;
  return !PERSONAL_DOMAINS.has(email.slice(at + 1).trim().toLowerCase());
}

const COLUMNS = 'nume, email, verificat_la, nr_confirmari, sursa';

interface ExistingRow {
  id: string;
  email: string;
  nr_confirmari: number;
}

export class SupabaseInstitutionsRepo implements InstitutionsRepo {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordVerifiedEmail(input: RecordVerifiedEmailInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const numeNormalizat = normalizeInstitutionName(input.name);
    if (!numeNormalizat || !isInstitutionalAddress(email)) return;

    const sursa: InstitutionSource = input.source ?? 'raspuns';
    const verificatLa = this.now().toISOString();
    const table = () => this.sb.from('institutii_locale');

    const { data, error } = await table().select('id, email, nr_confirmari').eq('nume_normalizat', numeNormalizat).maybeSingle();
    if (error) throw error;
    const existing = (data as ExistingRow | null) ?? null;

    if (!existing) {
      const { error: insertError } = await table().insert({
        nume_normalizat: numeNormalizat,
        nume: input.name.trim(),
        email,
        judet: input.judet ?? null,
        localitate: input.localitate ?? null,
        sursa,
        verificat_la: verificatLa,
        nr_confirmari: 1,
      });
      // 23505 = a concurrent insert won the unique race; the row exists now, nothing lost.
      if (insertError && insertError.code !== '23505') throw insertError;
      return;
    }

    const patch =
      existing.email === email
        ? { nr_confirmari: existing.nr_confirmari + 1, verificat_la: verificatLa }
        : { email, nume: input.name.trim(), sursa, nr_confirmari: 1, verificat_la: verificatLa };
    const { error: updateError } = await table().update(patch).eq('id', existing.id);
    if (updateError) throw updateError;
  }

  async findByName(name: string, limit: number = DEFAULT_FIND_LIMIT): Promise<KnownInstitution[]> {
    const numeNormalizat = normalizeInstitutionName(name);
    if (!numeNormalizat) return [];

    const exact = await this.sb.from('institutii_locale').select(COLUMNS).eq('nume_normalizat', numeNormalizat);
    if (exact.error) throw exact.error;
    const exactRows = (exact.data ?? []) as KnownInstitution[];
    if (exactRows.length > 0) return exactRows;

    const fuzzy = await this.sb
      .from('institutii_locale')
      .select(COLUMNS)
      .ilike('nume_normalizat', `%${numeNormalizat}%`)
      .order('nr_confirmari', { ascending: false })
      .limit(limit);
    if (fuzzy.error) throw fuzzy.error;
    return (fuzzy.data ?? []) as KnownInstitution[];
  }
}
