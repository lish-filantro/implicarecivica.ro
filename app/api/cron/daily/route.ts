/**
 * GET /api/cron/daily — Vercel Cron (02:00 UTC): reconcile R2 inbound, process
 * pending emails, mark overdue requests delayed. Requires CRON_SECRET.
 * Implementation: src/manager-544/cron/daily.ts
 */
import { createDailyCronHandler } from '@m544/cron/daily';
import { createDailyCronDeps } from '@m544/cron/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = createDailyCronHandler(createDailyCronDeps);
