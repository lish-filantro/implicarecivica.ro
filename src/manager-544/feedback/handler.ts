/**
 * POST /api/feedback — save a user's feedback (bug / sugestie / utilizare / altele).
 *   401 no session · 400 invalid body · 500 insert failed · 200 { success, feedback }
 */
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { createServerClient } from '@m544/shared/db/clients';
import type { FeedbackCategory } from '@m544/shared/types/feedback';
import { SupabaseFeedbackStore, type FeedbackStore } from './store';

export const FEEDBACK_CATEGORIES = ['bug', 'sugestie', 'utilizare', 'altele'] as const satisfies readonly FeedbackCategory[];

export interface FeedbackDeps<C extends AuthClient = SupabaseClient> {
  createClient: () => Promise<C>;
  store: (sb: C) => FeedbackStore;
}

const bodySchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, { errorMap: () => ({ message: 'Categorie invalidă' }) }),
  message: z.string().trim().min(5, 'Mesajul trebuie să aibă cel puțin 5 caractere'),
  page_url: z.string().nullish(),
});

export type FeedbackBody = z.infer<typeof bodySchema>;

export function createFeedbackHandler<C extends AuthClient>(getDeps: () => FeedbackDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;

    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { category, message, page_url } = parsed.data;

    try {
      const feedback = await deps.store(guard.supabase).insert({
        user_id: guard.user.id,
        category,
        message,
        page_url: page_url || null,
      });
      return json({ success: true, feedback });
    } catch (err) {
      console.error('[feedback] insert error:', err instanceof Error ? err.message : err);
      return httpError(500, 'Eroare la salvarea feedbackului');
    }
  }, 'feedback');
}

export function createFeedbackDeps(): FeedbackDeps {
  return {
    createClient: createServerClient,
    store: (sb) => new SupabaseFeedbackStore(sb),
  };
}
