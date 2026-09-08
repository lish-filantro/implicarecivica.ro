/**
 * Route handlers for request sessions. The `app/api/**` route files are
 * one-line adapters over these factories; tests inject fake deps.
 *
 *   POST /api/sessions/create             { name?, subject, institution_name, institution_email?, conversation_id?, questions[] }
 *   POST /api/sessions/[id]/add-requests  { questions[] }
 *   GET  /api/rate-limit/check?email=…    (or ?name=… when the institution has no email)
 *
 * All require a logged-in user. The daily limit (shared/rate-limit) is keyed on
 * the institution email, falling back to the institution name, so it applies
 * even when no email is known; counter errors surface as 500, never as "allow".
 */
import type { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import {
  checkDailyLimit,
  SupabaseSentCounter,
  type SentCounter,
  type DailyLimitStatus,
  type InstitutionRef,
} from '@m544/shared/rate-limit';
import { createServerClient } from '@m544/shared/db/clients';
import { SupabaseSessionsRepo, type SessionsRepo, type RequestInsert } from './repo';

export interface SessionsDeps<C extends AuthClient = AuthClient> {
  createClient: () => Promise<C>;
  /** Repos are built from the request's client so writes run as the user (RLS). */
  sessionsRepo: (sb: C) => SessionsRepo;
  sentCounter: (sb: C) => SentCounter;
  now?: () => Date;
}

export const defaultSessionsDeps = (): SessionsDeps<SupabaseClient> => ({
  createClient: createServerClient,
  sessionsRepo: (sb) => new SupabaseSessionsRepo(sb),
  sentCounter: (sb) => new SupabaseSentCounter(sb),
});

type RouteCtx = { params: Promise<{ id: string }> };
type Attempt<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

const MISSING_CREATE_FIELDS = 'Câmpuri lipsă: subject, institution_name, questions sunt obligatorii';
const MISSING_QUESTIONS = 'Câmpul "questions" este obligatoriu și trebuie să conțină cel puțin o întrebare';

const optionalText = z.string().nullish();
const createBodySchema = z.object({
  name: optionalText,
  subject: optionalText,
  institution_name: optionalText,
  institution_email: optionalText,
  conversation_id: optionalText,
  questions: z.array(z.string()).nullish(),
});
const addRequestsBodySchema = z.object({ questions: z.array(z.string()).nullish() });

function limitExceeded(status: DailyLimitStatus): NextResponse {
  return httpError(429, `Ai atins limita de cereri către această instituție azi. Mai poți trimite ${status.remaining}.`, {
    sent_today: status.sent_today,
    remaining: status.remaining,
    limit: status.limit,
  });
}

/** Run a repo call; a failure becomes a 500 with the legacy message (details only in the log). */
async function attempt<T>(label: string, message: string, fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    console.error(`[${label}]`, err);
    return { ok: false, response: httpError(500, message) };
  }
}

interface SessionLike {
  id: string;
  institution_name: string;
  institution_email?: string | null;
  subject: string;
}

function requestRows(userId: string, session: SessionLike, questions: string[], now: () => Date): RequestInsert[] {
  const dateInitiated = now().toISOString();
  return questions.map((question) => ({
    user_id: userId,
    session_id: session.id,
    institution_name: session.institution_name,
    institution_email: session.institution_email || null,
    subject: session.subject,
    request_body: question,
    status: 'pending',
    date_initiated: dateInitiated,
  }));
}

export function createSessionsCreateHandler<C extends AuthClient>(getDeps: () => SessionsDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser(deps);
    if (!guard.ok) return guard.response;

    const body = await parseJsonBody(request, createBodySchema);
    if (!body.ok) return body.response;
    const { name, subject, institution_name, institution_email, conversation_id, questions } = body.data;
    if (!subject || !institution_name || !questions?.length) return httpError(400, MISSING_CREATE_FIELDS);

    const institution: InstitutionRef = { email: institution_email, name: institution_name };
    const limit = await checkDailyLimit(guard.user.id, institution, questions.length, deps.sentCounter(guard.supabase), deps.now);
    if (!limit.ok) return limitExceeded(limit);

    const repo = deps.sessionsRepo(guard.supabase);
    const session = await attempt('sessions/create', 'Eroare la crearea sesiunii', () =>
      repo.insertSession({
        user_id: guard.user.id,
        name: name || null,
        subject,
        institution_name,
        institution_email: institution_email || null,
        conversation_id: conversation_id || null,
        total_requests: questions.length,
      }),
    );
    if (!session.ok) return session.response;

    const rows = requestRows(guard.user.id, session.value, questions, deps.now ?? (() => new Date()));
    const requests = await attempt('sessions/create', 'Eroare la crearea cererilor', () => repo.insertRequests(rows));
    if (!requests.ok) return requests.response;

    return json({ success: true, session: session.value, requests: requests.value });
  }, 'sessions/create');
}

export function createAddRequestsHandler<C extends AuthClient>(getDeps: () => SessionsDeps<C>) {
  return withErrorBoundary<RouteCtx>(async (request: NextRequest, ctx) => {
    if (!ctx) throw new Error('route params missing');
    const deps = getDeps();
    const guard = await requireUser(deps);
    if (!guard.ok) return guard.response;

    const { id: sessionId } = await ctx.params;
    const body = await parseJsonBody(request, addRequestsBodySchema);
    if (!body.ok) return body.response;
    const questions = body.data.questions;
    if (!questions?.length) return httpError(400, MISSING_QUESTIONS);

    const repo = deps.sessionsRepo(guard.supabase);
    const session = await repo.getSessionForUser(sessionId, guard.user.id);
    if (!session) return httpError(404, 'Sesiunea nu a fost găsită');

    const institution: InstitutionRef = { email: session.institution_email, name: session.institution_name };
    const limit = await checkDailyLimit(guard.user.id, institution, questions.length, deps.sentCounter(guard.supabase), deps.now);
    if (!limit.ok) return limitExceeded(limit);

    const rows = requestRows(guard.user.id, session, questions, deps.now ?? (() => new Date()));
    const requests = await attempt('sessions/add-requests', 'Eroare la crearea cererilor', () => repo.insertRequests(rows));
    if (!requests.ok) return requests.response;

    // Same value the DB trigger computes; kept explicit like the legacy route.
    const total = (session.total_requests ?? 0) + questions.length;
    await repo.setTotalRequests(session.id, total);

    return json({ success: true, session: { ...session, total_requests: total }, requests: requests.value });
  }, 'sessions/add-requests');
}

export function createRateLimitCheckHandler<C extends AuthClient>(getDeps: () => SessionsDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser(deps);
    if (!guard.ok) return guard.response;

    const email = request.nextUrl.searchParams.get('email')?.trim();
    const name = request.nextUrl.searchParams.get('name')?.trim();
    if (!email && !name) return httpError(400, 'Parametrul "email" este obligatoriu');

    const institution: InstitutionRef = email ? email : { email: null, name: name ?? '' };
    const status = await checkDailyLimit(guard.user.id, institution, 0, deps.sentCounter(guard.supabase), deps.now);
    return json({ sent_today: status.sent_today, remaining: status.remaining, limit: status.limit });
  }, 'rate-limit/check');
}
