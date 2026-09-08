/**
 * Route handlers for the processing pipeline. The `app/api/**` route files are
 * one-line adapters over these factories; tests build handlers with fake deps.
 *
 *   POST /api/emails/process        { email_id } | { batch: true, limit? }
 *   GET  /api/cron/process-emails   daily safety net (batch of 5)
 *   GET  /api/cron/check-deadlines  mark overdue requests as delayed
 *
 * All three require `Authorization: Bearer <CRON_SECRET>`.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCronSecret } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { markDelayedRequests } from '@m544/pipeline/status';
import { processEmail, type ProcessDeps } from './process-email';
import { processPendingBatch, DEFAULT_BATCH_LIMIT } from './batch';

export type DepsFactory = () => ProcessDeps;

const processBodySchema = z.union([
  z.object({ email_id: z.string().uuid() }),
  z.object({ batch: z.literal(true), limit: z.number().int().min(1).max(50).optional() }),
]);

export function createProcessEmailHandler(getDeps: DepsFactory) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const body = await parseJsonBody(request, processBodySchema);
    if (!body.ok) return body.response;

    const deps = getDeps();
    if ('email_id' in body.data) {
      return json(await processEmail(body.data.email_id, deps));
    }
    return json(await processPendingBatch(body.data.limit ?? DEFAULT_BATCH_LIMIT, deps));
  }, 'emails/process');
}

export function createProcessCronHandler(getDeps: DepsFactory) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const summary = await processPendingBatch(DEFAULT_BATCH_LIMIT, getDeps());
    console.log(
      `[Cron:process-emails] processed=${summary.processed} ok=${summary.successful} failed=${summary.failed}`,
    );
    return json(summary);
  }, 'cron/process-emails');
}

export function createCheckDeadlinesHandler(getDeps: DepsFactory) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const delayedCount = await markDelayedRequests({ requests: getDeps().requests });
    console.log(`[Cron:check-deadlines] marked ${delayedCount} requests as delayed`);
    return json({ success: true, delayed_count: delayedCount, checked_at: new Date().toISOString() });
  }, 'cron/check-deadlines');
}

/** Exposed for tests of the schema itself. */
export const _processBodySchema = processBodySchema;
export { httpError };
