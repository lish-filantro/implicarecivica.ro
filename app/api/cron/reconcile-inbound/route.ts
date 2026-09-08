/**
 * GET /api/cron/reconcile-inbound — Vercel Cron (every 6 h): ingest raw emails
 * left in R2 by a failed webhook call. Requires CRON_SECRET.
 */
import { createReconcileInboundHandler } from '@m544/inbound/reconcile/handler';
import { createReconcileDeps } from '@m544/inbound/reconcile/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = createReconcileInboundHandler(createReconcileDeps);
