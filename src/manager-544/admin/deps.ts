/**
 * Real dependencies for the admin routes: the session is read through the
 * cookie-bound server client (requireAdmin); the data goes through the
 * service-role client (cross-user aggregates + auth.admin).
 */
import { createServerClient, createServiceClient } from '@m544/shared/db/clients';
import type { AdminDeps } from './handlers';
import { SupabaseAdminStatsRepo, SupabaseAdminUsersRepo } from './supabase-repos';

export function createAdminDeps(): AdminDeps {
  const service = createServiceClient();
  return {
    createClient: () => createServerClient(),
    stats: new SupabaseAdminStatsRepo(service),
    users: new SupabaseAdminUsersRepo(service),
  };
}
