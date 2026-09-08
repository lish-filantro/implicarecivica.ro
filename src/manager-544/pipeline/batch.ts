/**
 * Batch processing of pending received emails (daily cron safety net).
 * Sequential on purpose: Mistral free tier rate limits and the Vercel function budget.
 */
import { processEmail, type ProcessDeps, type ProcessResult } from './process-email';

export interface BatchSummary {
  processed: number;
  successful: number;
  failed: number;
  results: ProcessResult[];
}

export const DEFAULT_BATCH_LIMIT = 5;

export async function processPendingBatch(limit: number, deps: ProcessDeps): Promise<BatchSummary> {
  const ids = await deps.emails.listPendingReceived(limit);
  const results: ProcessResult[] = [];
  for (const id of ids) {
    results.push(await processEmail(id, deps));
  }
  return {
    processed: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
