/**
 * GET /api/cron/process-emails
 *
 * Vercel Cron Job — runs every minute to process pending received emails.
 * Pipeline: OCR → AI Analysis → Match to Request → Update Status
 *
 * Schedule: * * * * * (every minute)
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
      body: JSON.stringify({ batch: true, limit: 3 }), // 3 emails per run (~15s each = ~45s total)
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
