/**
 * GET /api/cron/check-deadlines
 *
 * Vercel Cron Job — runs daily at 02:00 UTC to check for overdue requests.
 * Marks requests past their effective deadline as 'delayed'.
 *
 * Schedule: 0 2 * * * (daily at 2 AM)
 * Configured in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAndMarkDelayedRequests } from '@/lib/services/status-updater';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && cronSecret !== 'placeholder') {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const delayedCount = await checkAndMarkDelayedRequests();

    console.log(`[Cron:check-deadlines] Marked ${delayedCount} requests as delayed`);

    return NextResponse.json({
      success: true,
      delayed_count: delayedCount,
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron:check-deadlines] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
