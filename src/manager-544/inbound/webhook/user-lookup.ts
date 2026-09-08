/**
 * Which user owns an inbound recipient address.
 * Primary: profiles.mailcow_email. Fallback: a user who previously sent from
 * that platform address (profiles created before mailcow_email existed).
 */
import type { ProfilesRepo } from '@m544/shared/db/profiles-repo';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';

export interface UserLookupDeps {
  profiles: ProfilesRepo;
  emails: EmailsRepo;
}

export async function resolveRecipientUser(toEmail: string, deps: UserLookupDeps): Promise<string | null> {
  const address = toEmail.trim().toLowerCase();
  const byProfile = await deps.profiles.findIdByMailcowEmail(address);
  if (byProfile) return byProfile;
  return deps.emails.findSenderUserId(address);
}
