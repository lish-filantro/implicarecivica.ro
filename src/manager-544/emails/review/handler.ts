/**
 * POST /api/emails/[id]/review — manual review of a received email.
 *
 *   body: { action: 'assign', request_id }               link to one of the user's requests
 *       | { action: 'reclassify', category, note? }      correct the AI category (+ feedback row)
 *       | { action: 'dismiss' }                          just clear the review flag
 *
 * Auth via requireUser; every read/write runs on the cookie-bound session
 * client, so RLS makes another user's email indistinguishable from a missing
 * one (404 either way). Response: `{ success: true, email }`.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import { EMAIL_CATEGORIES } from './analysis-from-email';
import type { ReviewRepo } from './repo';
import { reviewEmail, EMAIL_NOT_FOUND, type ReviewAction } from './service';

export interface ReviewHandlerDeps<C extends AuthClient = AuthClient> {
  createClient: () => Promise<C>;
  /** Repos are built from the request's client so every query runs as the user (RLS). */
  emails: (sb: C) => EmailsRepo;
  requests: (sb: C) => RequestsRepo;
  review: (sb: C) => ReviewRepo;
}

type RouteCtx = { params: Promise<{ id: string }> };

export const reviewBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('assign'), request_id: z.string().uuid() }),
  z.object({
    action: z.literal('reclassify'),
    category: z.enum(EMAIL_CATEGORIES as [string, ...string[]]),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal('dismiss') }),
]);

const uuidSchema = z.string().uuid();

export function createReviewEmailHandler<C extends AuthClient>(getDeps: () => ReviewHandlerDeps<C>) {
  return withErrorBoundary<RouteCtx>(async (request: NextRequest, ctx) => {
    if (!ctx) throw new Error('route params missing');
    const deps = getDeps();
    const guard = await requireUser(deps);
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    if (!uuidSchema.safeParse(id).success) return httpError(404, EMAIL_NOT_FOUND);

    const body = await parseJsonBody(request, reviewBodySchema);
    if (!body.ok) return body.response;

    const result = await reviewEmail(
      { emailId: id, userId: guard.user.id, action: body.data as ReviewAction },
      {
        emails: deps.emails(guard.supabase),
        requests: deps.requests(guard.supabase),
        review: deps.review(guard.supabase),
      },
    );
    if (!result.ok) return httpError(result.status, result.error);
    return json({ success: true, email: result.email });
  }, 'emails/review');
}
