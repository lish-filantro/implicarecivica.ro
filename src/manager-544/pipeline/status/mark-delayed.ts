/**
 * Nightly overdue check: requests whose effective deadline has passed become 'delayed'.
 * Filtering happens in the database (RequestsRepo.listOverdueIds), not in memory.
 */
import type { RequestsRepo } from '@m544/shared/db/requests-repo';

export interface MarkDelayedDeps {
  requests: RequestsRepo;
  /** Injectable clock (tests); defaults to the system clock. */
  now?: () => Date;
}

/** Marks every overdue open request as delayed; returns how many were updated. */
export async function markDelayedRequests(deps: MarkDelayedDeps): Promise<number> {
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const ids = await deps.requests.listOverdueIds(nowIso);

  let count = 0;
  for (const id of ids) {
    try {
      await deps.requests.update(id, { status: 'delayed' });
      count++;
    } catch (err) {
      console.error(`[CheckDelayed] Failed to mark request ${id} as delayed:`, err);
    }
  }

  console.log(`[CheckDelayed] Total marked delayed: ${count}`);
  return count;
}
