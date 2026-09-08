/**
 * GET /api/cron/daily — the single daily maintenance job.
 *
 * Vercel's Hobby plan allows two cron jobs, each at most once a day, so the
 * maintenance steps run here in sequence (the dedicated routes stay callable
 * by hand with the same secret):
 *   1. reconcile-inbound  ingest raw emails left in R2 (no inline processing:
 *                         they become `pending` for step 2)
 *   2. process-emails     batch of pending received emails (OCR + classification)
 *   3. check-deadlines    overdue requests → delayed
 *
 * Each step is isolated: a failure is recorded in `errors` and the next step
 * still runs. Requires `Authorization: Bearer <CRON_SECRET>`.
 */
import type { NextRequest } from 'next/server';
import { requireCronSecret } from '@m544/shared/auth';
import { json, withErrorBoundary } from '@m544/shared/http';
import { markDelayedRequests } from '@m544/pipeline/status';
import { processPendingBatch, DEFAULT_BATCH_LIMIT, type BatchSummary } from '@m544/pipeline/batch';
import type { ProcessDeps } from '@m544/pipeline/process-email';
import { reconcileInbound, type ReconcileDeps, type ReconcileSummary } from '@m544/inbound/reconcile/reconcile';

export interface DailyCronDeps {
  pipeline: ProcessDeps;
  reconcile: ReconcileDeps;
  batchLimit?: number;
  now?: () => Date;
}

export interface DailyCronSummary {
  success: boolean;
  reconcile: Omit<ReconcileSummary, 'details'> | null;
  processed: Omit<BatchSummary, 'results'> | null;
  delayed_count: number | null;
  errors: Array<{ step: 'reconcile' | 'process' | 'deadlines'; message: string }>;
  checked_at: string;
}

const message = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

export async function runDailyMaintenance(deps: DailyCronDeps): Promise<DailyCronSummary> {
  const summary: DailyCronSummary = {
    success: true,
    reconcile: null,
    processed: null,
    delayed_count: null,
    errors: [],
    checked_at: (deps.now ?? (() => new Date()))().toISOString(),
  };

  try {
    const { details: _details, ...rest } = await reconcileInbound(deps.reconcile);
    summary.reconcile = rest;
  } catch (err) {
    summary.errors.push({ step: 'reconcile', message: message(err) });
  }

  try {
    const { results: _results, ...rest } = await processPendingBatch(deps.batchLimit ?? DEFAULT_BATCH_LIMIT, deps.pipeline);
    summary.processed = rest;
  } catch (err) {
    summary.errors.push({ step: 'process', message: message(err) });
  }

  try {
    summary.delayed_count = await markDelayedRequests({ requests: deps.pipeline.requests, now: deps.now });
  } catch (err) {
    summary.errors.push({ step: 'deadlines', message: message(err) });
  }

  summary.success = summary.errors.length === 0;
  return summary;
}

export function createDailyCronHandler(getDeps: () => DailyCronDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const summary = await runDailyMaintenance(getDeps());
    console.log(
      `[Cron:daily] reconcile=${summary.reconcile?.ingested ?? '-'} processed=${summary.processed?.processed ?? '-'} ` +
        `delayed=${summary.delayed_count ?? '-'} errors=${summary.errors.length}`,
    );
    return json(summary);
  }, 'cron/daily');
}
