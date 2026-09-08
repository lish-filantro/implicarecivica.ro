/** Production wiring for the review handler: session client + Supabase repos on it. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@m544/shared/db/clients';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';
import { SupabaseRequestsRepo } from '@m544/shared/db/requests-repo';
import type { ReviewHandlerDeps } from './handler';
import { SupabaseReviewRepo } from './repo';

export function createReviewDeps(): ReviewHandlerDeps<SupabaseClient> {
  return {
    createClient: createServerClient,
    emails: (sb) => new SupabaseEmailsRepo(sb),
    requests: (sb) => new SupabaseRequestsRepo(sb),
    review: (sb) => new SupabaseReviewRepo(sb),
  };
}
