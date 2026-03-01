/**
 * Status Updater Service — Applies AI analysis results to request status
 *
 * Handles all status transitions based on email category:
 * - inregistrate → received (+ registration number + deadline 10 days)
 * - amanate → extension (+ extension_date = date_received + 30 days total)
 * - raspunse → answered (+ answer_summary)
 * - intarziate → answered (late response)
 *
 * Deadline logic per Law 544/2001:
 * - Standard: 10 calendar days from date_received
 * - With extension: 10 + 20 = 30 calendar days from date_received
 */

import { createServerClient } from '@supabase/ssr';
import type { AnalysisResult } from './analysis-service';

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Add calendar days to a date, returning ISO date string (YYYY-MM-DD format as timestamptz).
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export interface StatusUpdateResult {
  previousStatus: string;
  newStatus: string;
  changes: Record<string, unknown>;
}

/**
 * Apply analysis results to a request's status and metadata.
 *
 * This function is idempotent — if the request is already in a terminal state
 * ('answered'), it won't downgrade it.
 */
export async function applyStatusUpdate(
  requestId: string,
  emailId: string,
  emailReceivedAt: string,
  analysis: AnalysisResult,
): Promise<StatusUpdateResult | null> {
  const supabase = getServiceClient();

  // Fetch current request state
  const { data: request, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error || !request) {
    console.error(`[StatusUpdate] Request ${requestId} not found:`, error);
    return null;
  }

  // Don't downgrade from 'answered'
  if (request.status === 'answered') {
    console.log(`[StatusUpdate] Request ${requestId} already answered, skipping`);
    return null;
  }

  const previousStatus = request.status;
  const changes: Record<string, unknown> = {};

  switch (analysis.category) {
    case 'inregistrate': {
      // Registration confirmation received
      if (analysis.registration_number) {
        changes.registration_number = analysis.registration_number;
      }

      const dateReceived = emailReceivedAt;
      changes.date_received = dateReceived;

      // Deadline = date_received + 10 calendar days
      changes.deadline_date = addDays(dateReceived, 10);

      // Status → received (persistent, unlike the old Django system)
      changes.status = 'received';

      console.log(
        `[StatusUpdate] ${requestId}: pending → received (reg: ${analysis.registration_number}, deadline: ${changes.deadline_date})`,
      );
      break;
    }

    case 'amanate': {
      // Institution requested extension
      // Extension deadline = date_received + 30 days total (10 standard + 20 extra)
      const baseDate = request.date_received || emailReceivedAt;
      changes.extension_date = addDays(baseDate, 30);
      changes.extension_days = 20;
      changes.status = 'extension';

      if (analysis.extension_reason) {
        changes.extension_reason = analysis.extension_reason;
      }

      console.log(
        `[StatusUpdate] ${requestId}: ${previousStatus} → extension (deadline: ${changes.extension_date})`,
      );
      break;
    }

    case 'raspunse': {
      // Final response received
      changes.response_received_date = emailReceivedAt;
      changes.status = 'answered';

      if (analysis.answer_summary) {
        changes.answer_summary = analysis.answer_summary;
      }

      console.log(`[StatusUpdate] ${requestId}: ${previousStatus} → answered`);
      break;
    }

    case 'intarziate': {
      // Late response — still counts as answered
      changes.response_received_date = emailReceivedAt;
      changes.status = 'answered';

      if (analysis.answer_summary) {
        changes.answer_summary = analysis.answer_summary;
      }

      console.log(`[StatusUpdate] ${requestId}: ${previousStatus} → answered (late)`);
      break;
    }
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  // Apply changes
  const { error: updateError } = await supabase
    .from('requests')
    .update(changes)
    .eq('id', requestId);

  if (updateError) {
    console.error(`[StatusUpdate] Failed to update request ${requestId}:`, updateError);
    throw updateError;
  }

  // Link email to request
  await supabase
    .from('emails')
    .update({ request_id: requestId })
    .eq('id', emailId);

  // Note: request_sessions.cached_status is automatically recalculated
  // by the DB trigger handle_request_session_update() → recalculate_session_status()

  return {
    previousStatus,
    newStatus: (changes.status as string) || previousStatus,
    changes,
  };
}

/**
 * Check all active requests for overdue deadlines and mark as 'delayed'.
 * Called by the nightly cron job.
 */
export async function checkAndMarkDelayedRequests(): Promise<number> {
  const supabase = getServiceClient();

  const now = new Date().toISOString();
  let delayedCount = 0;

  // Find requests that are past their effective deadline and not yet answered/delayed
  const { data: requests, error } = await supabase
    .from('requests')
    .select('id, status, deadline_date, extension_date')
    .not('status', 'in', '("answered","delayed")');

  if (error) {
    console.error('[CheckDelayed] Failed to fetch requests:', error);
    throw error;
  }

  if (!requests) return 0;

  for (const req of requests) {
    const effectiveDeadline = req.extension_date || req.deadline_date;
    if (!effectiveDeadline) continue;

    if (new Date(effectiveDeadline) < new Date(now)) {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: 'delayed' })
        .eq('id', req.id);

      if (!updateError) {
        delayedCount++;
        console.log(`[CheckDelayed] Marked request ${req.id} as delayed`);
      }
    }
  }

  console.log(`[CheckDelayed] Total marked delayed: ${delayedCount}`);
  return delayedCount;
}
