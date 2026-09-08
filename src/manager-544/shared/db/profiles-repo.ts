/**
 * Profiles repository — lookups on `profiles` needed server-side
 * (inbound routing by platform address, sender identity for outgoing mail).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SenderIdentity {
  display_name: string | null;
  mailcow_email: string | null;
}

export interface ProfilesRepo {
  /** User owning the platform address (case-insensitive). */
  findIdByMailcowEmail(email: string): Promise<string | null>;
  getSenderIdentity(userId: string): Promise<SenderIdentity | null>;
}

export class SupabaseProfilesRepo implements ProfilesRepo {
  constructor(private readonly sb: SupabaseClient) {}

  async findIdByMailcowEmail(email: string): Promise<string | null> {
    const { data, error } = await this.sb.from('profiles').select('id').ilike('mailcow_email', email).limit(1);
    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async getSenderIdentity(userId: string): Promise<SenderIdentity | null> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('display_name, mailcow_email')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as SenderIdentity | null) ?? null;
  }
}
