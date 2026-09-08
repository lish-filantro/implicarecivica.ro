/**
 * GET /api/cron/notify-deadlines — send the daily deadline digests.
 * Requires `Authorization: Bearer <CRON_SECRET>`; returns the run summary.
 */
import type { NextRequest } from 'next/server';
import { requireCronSecret } from '@m544/shared/auth';
import { json, withErrorBoundary } from '@m544/shared/http';
import { sendDeadlineDigests, type DigestDeps } from './digest';

export function createNotifyDeadlinesHandler(getDeps: () => DigestDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireCronSecret(request);
    if (!guard.ok) return guard.response;

    const summary = await sendDeadlineDigests(getDeps());
    console.log(
      `[Cron:notify-deadlines] users=${summary.users} emails_sent=${summary.emails_sent} ` +
        `notices=${summary.notices} skipped=${summary.skipped} errors=${summary.errors}`,
    );
    return json({ success: true, ...summary, checked_at: new Date().toISOString() });
  }, 'cron/notify-deadlines');
}
