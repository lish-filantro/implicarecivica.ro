/**
 * Real dependencies for the admin routes: the session is read through the
 * cookie-bound server client (requireAdmin); the data goes through the
 * service-role client (cross-user aggregates + auth.admin).
 */
import { createServerClient, createServiceClient } from '@m544/shared/db/clients';
import { optionalEnv } from '@m544/shared/env';
import { getResend } from '@m544/emails/resend-client';
import { DEFAULT_APP_URL, DEFAULT_EMAIL_DOMAIN } from '@m544/notifications/deps';
import type { AdminDeps } from './handlers';
import { SupabaseAdminStatsRepo, SupabaseAdminUsersRepo } from './supabase-repos';

export function createAdminDeps(): AdminDeps {
  const service = createServiceClient();
  const domain = optionalEnv('NEXT_PUBLIC_EMAIL_DOMAIN', DEFAULT_EMAIL_DOMAIN);
  return {
    createClient: () => createServerClient(),
    stats: new SupabaseAdminStatsRepo(service),
    users: new SupabaseAdminUsersRepo(service),
    approvalMailer: {
      // Lazy, like the digest: a missing RESEND_API_KEY must surface when we send,
      // not while building deps for /api/admin/stats.
      get sender() {
        return getResend().emails;
      },
      fromAddress: `Implicare Civică <notificari@${domain}>`,
      appUrl: optionalEnv('NEXT_PUBLIC_APP_URL', DEFAULT_APP_URL),
    },
  };
}
