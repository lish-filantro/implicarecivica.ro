/**
 * GET /api/cron/check-deadlines — Vercel Cron (02:00 UTC): requests past their
 * effective deadline become 'delayed'. Requires CRON_SECRET.
 */
import { createCheckDeadlinesHandler } from '@m544/pipeline/handlers';
import { createPipelineDeps } from '@m544/pipeline/deps';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const GET = createCheckDeadlinesHandler(createPipelineDeps);
