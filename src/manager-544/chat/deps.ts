/**
 * Real dependencies for the chat route (cookie-bound Supabase client for auth,
 * Anthropic SDK client). Tests build their own ChatDeps with fakes.
 */
import { createServerClient } from '@m544/shared/db/clients';
import { createAnthropicClient } from '@m544/chat/anthropic/client';
import type { ChatDeps } from './handler';

export function createChatDeps(): ChatDeps {
  return { createClient: createServerClient, createAnthropic: createAnthropicClient };
}
