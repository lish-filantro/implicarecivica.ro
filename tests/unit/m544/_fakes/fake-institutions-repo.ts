/**
 * In-memory InstitutionsRepo (institutii_locale). Mirrors the Supabase
 * implementation: keyed by the normalized name, same-email confirmations add
 * up, a new email replaces the row and resets the count; personal addresses
 * and blank names are ignored. Records every call for assertions.
 */
import {
  DEFAULT_FIND_LIMIT,
  isInstitutionalAddress,
  type InstitutionsRepo,
  type KnownInstitution,
  type RecordVerifiedEmailInput,
} from '@m544/shared/db/institutions-repo';
import { normalizeInstitutionName } from '@m544/shared/utils/normalize-name';

export class FakeInstitutionsRepo implements InstitutionsRepo {
  rows = new Map<string, KnownInstitution>();
  calls: RecordVerifiedEmailInput[] = [];
  /** Thrown (once) by the next recordVerifiedEmail — error-path tests. */
  failNext: Error | null = null;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async recordVerifiedEmail(input: RecordVerifiedEmailInput): Promise<void> {
    this.calls.push(input);
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
    const email = input.email.trim().toLowerCase();
    const key = normalizeInstitutionName(input.name);
    if (!key || !isInstitutionalAddress(email)) return;

    const verificat_la = this.now().toISOString();
    const sursa = input.source ?? 'raspuns';
    const existing = this.rows.get(key);
    if (existing && existing.email === email) {
      this.rows.set(key, { ...existing, nr_confirmari: existing.nr_confirmari + 1, verificat_la });
      return;
    }
    this.rows.set(key, { nume: input.name.trim(), email, verificat_la, nr_confirmari: 1, sursa });
  }

  async findByName(name: string, limit: number = DEFAULT_FIND_LIMIT): Promise<KnownInstitution[]> {
    const key = normalizeInstitutionName(name);
    if (!key) return [];
    const exact = this.rows.get(key);
    if (exact) return [exact];
    return [...this.rows.entries()]
      .filter(([k]) => k.includes(key))
      .map(([, v]) => v)
      .sort((a, b) => b.nr_confirmari - a.nr_confirmari)
      .slice(0, limit);
  }
}
