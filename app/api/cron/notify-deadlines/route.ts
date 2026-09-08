/**
 * GET /api/cron/notify-deadlines — Vercel Cron (06:00 UTC): one email per
 * opted-in user with upcoming / overdue request deadlines. Requires CRON_SECRET.
 */
import { createNotifyDeadlinesHandler } from '@m544/notifications/handler';
import { createNotificationDeps } from '@m544/notifications/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const GET = createNotifyDeadlinesHandler(createNotificationDeps);
