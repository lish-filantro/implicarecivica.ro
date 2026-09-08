/**
 * GET /auth/callback — Supabase PKCE code exchange, then redirect to `next`
 * (same-origin paths only). Implementation: src/manager-544/shared/auth/callback.
 */
import { createAuthCallbackHandler } from '@m544/shared/auth/callback';

export const GET = createAuthCallbackHandler();
