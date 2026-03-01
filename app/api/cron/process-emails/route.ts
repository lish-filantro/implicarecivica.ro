/**
 * GET /api/cron/process-emails
 *
 * Vercel Cron Job — daily fallback to catch any emails that weren't
 * processed by the webhook fire-and-forget trigger.
 * Pipeline: OCR → AI Analysis → Match to Request → Update Status
 *
 * Primary processing happens instantly via webhook → fire-and-forget.
 * This cron is a safety net for retries and missed emails.
 *
 * Schedule: 0 3 * * * (daily at 3 AM UTC)
 * Configured in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Vercel serverless max (Hobby plan)
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
    // Call the process endpoint with batch mode
    const processUrl = new URL('/api/emails/process', request.url);
    const response = await fetch(processUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({ batch: true, limit: 5 }), // Daily fallback — process up to 5 missed emails
    });

    const result = await response.json();

    console.log(
      `[Cron:process-emails] Processed: ${result.processed || 0}, ` +
      `Success: ${result.successful || 0}, Failed: ${result.failed || 0}`,
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron:process-emails] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
