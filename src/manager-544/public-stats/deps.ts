/**
 * Production dependencies for the public statistics route: the service-role
 * client (the aggregate spans all users; only status/date columns are read).
 */
import { createServiceClient } from '@m544/shared/db/clients';
import type { PublicStatsDeps } from './handler';
import { SupabasePublicStatsRepo } from './repo';

export function createPublicStatsDeps(): PublicStatsDeps {
  return {
    repo: new SupabasePublicStatsRepo(createServiceClient()),
    now: () => new Date(),
  };
}
