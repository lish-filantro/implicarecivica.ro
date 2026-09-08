/**
 * GET /api/cron/reconcile-inbound — Vercel Cron (every 6 h): ingest the raw
 * emails still parked in R2 whose webhook call never landed.
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
import type { NextRequest } from 'next/server';
import { requireCronSecret } from '@m544/shared/auth';
import { json, withErrorBoundary } from '@m544/shared/http';
import { reconcileInbound, type ReconcileDeps } from './reconcile';

export type ReconcileDepsFactory = () => ReconcileDeps;

export function createReconcileInboundHandler(getDeps: ReconcileDepsFactory) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const summary = await reconcileInbound(getDeps());
    return json({ ...summary, checked_at: new Date().toISOString() });
  }, 'cron/reconcile-inbound');
}
