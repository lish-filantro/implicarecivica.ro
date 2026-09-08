/**
 * Production dependencies for the deadline digest cron: service-role repo,
 * Resend as the sender (resolved lazily so a missing RESEND_API_KEY surfaces
 * as an EnvError at send time, not while building deps) and the public URLs.
 */
import { createServiceClient } from '@m544/shared/db/clients';
import { optionalEnv } from '@m544/shared/env';
import { getResend } from '@m544/emails/resend-client';
import { SupabaseNotificationsRepo } from './repo';
import type { DigestDeps } from './digest';

export const DEFAULT_APP_URL = 'https://implicarecivica.ro';
export const DEFAULT_EMAIL_DOMAIN = 'implicarecivica.ro';

export function createNotificationDeps(): DigestDeps {
  const domain = optionalEnv('NEXT_PUBLIC_EMAIL_DOMAIN', DEFAULT_EMAIL_DOMAIN);
  return {
    repo: new SupabaseNotificationsRepo(createServiceClient()),
    get sender() {
      return getResend().emails;
    },
    appUrl: optionalEnv('NEXT_PUBLIC_APP_URL', DEFAULT_APP_URL),
    fromAddress: `Implicare Civică <notificari@${domain}>`,
  };
}
