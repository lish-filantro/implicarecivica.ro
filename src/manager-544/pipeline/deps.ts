/**
 * Real dependencies for the processing pipeline (service-role Supabase client).
 * Route handlers call this; tests build their own ProcessDeps with fakes.
 */
import { createServiceClient } from '@m544/shared/db/clients';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';
import { SupabaseRequestsRepo } from '@m544/shared/db/requests-repo';
import { SupabaseStorageRepo } from '@m544/shared/db/storage-repo';
import type { ProcessDeps } from './process-email';

export function createPipelineDeps(): ProcessDeps {
  const sb = createServiceClient();
  return {
    emails: new SupabaseEmailsRepo(sb),
    requests: new SupabaseRequestsRepo(sb),
    storage: new SupabaseStorageRepo(sb),
  };
}
