/**
 * GET /api/cron/process-emails — Vercel Cron (03:00 UTC), safety net for emails
 * the webhook trigger missed. Requires CRON_SECRET (sent by Vercel automatically).
 */
import { createProcessCronHandler } from '@m544/pipeline/handlers';
import { createPipelineDeps } from '@m544/pipeline/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = createProcessCronHandler(createPipelineDeps);
