/**
 * Real dependencies for the chat route (cookie-bound Supabase client for auth
 * and the daily quota, Anthropic SDK client, service-role read of the verified
 * institution addresses). Tests build their own ChatDeps with fakes.
 */
import { createServerClient, createServiceClient } from '@m544/shared/db/clients';
import { SupabaseInstitutionsRepo } from '@m544/shared/db/institutions-repo';
import { createAnthropicClient } from '@m544/chat/anthropic/client';
import { SupabaseChatUsageCounter } from '@m544/chat/rate-limit';
import type { ChatDeps } from './handler';

export function createChatDeps(): ChatDeps {
  return {
    createClient: createServerClient,
    createAnthropic: createAnthropicClient,
    // institutii_locale has no RLS policies: only the service role can read it.
    // Created lazily per lookup so a missing service key degrades to "no enrichment" (the lookup is best-effort).
    lookupInstitution: (name) => new SupabaseInstitutionsRepo(createServiceClient()).findByName(name),
    // Session client: RLS scopes the count to the caller's own conversations.
    usage: new SupabaseChatUsageCounter(createServerClient),
  };
}
