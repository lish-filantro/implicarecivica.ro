/**
 * Reconcile the `inbound/` staging area: every raw email the worker stored
 * whose webhook call never landed (deploy, 5xx, timeout) is still in R2 with
 * its envelope in customMetadata. Rebuild the envelope and ingest it.
 *
 *   - objects newer than `minAgeMinutes` are in flight → not touched
 *   - objects older than `maxAgeDays` are reported as `stale` → not touched
 *   - metadata that does not form a valid envelope → `skipped` (kept for a human)
 *   - per-object errors are logged and counted; the loop continues
 */
import { log as defaultLog, type Logger } from '@m544/shared/log';
import { parseWorkerPayload, type InboundEnvelope } from '../webhook/payload';
import type { IngestResult } from '../ingest';
import type { R2ObjectInfo } from './r2-list';

export const DEFAULT_MIN_AGE_MINUTES = 10;
export const DEFAULT_MAX_INGEST = 10;
const DEFAULT_MAX_AGE_DAYS = 7;

export interface ReconcileDeps {
  list: () => Promise<R2ObjectInfo[]>;
  head: (key: string) => Promise<Record<string, string>>;
  ingest: (env: InboundEnvelope) => Promise<IngestResult>;
  now?: () => Date;
  minAgeMinutes?: number;
  maxAgeDays?: number;
  /** Upper bound of objects ingested per run (processing runs inline; keeps the cron under the function timeout). */
  maxIngest?: number;
  log?: Logger;
}

export type ReconcileOutcome = 'ingested' | 'duplicate' | 'skipped' | 'stale' | 'error' | 'in_flight' | 'deferred';

export interface ReconcileDetail {
  key: string;
  outcome: ReconcileOutcome;
  reason?: string;
}

export interface ReconcileSummary {
  scanned: number;
  ingested: number;
  duplicates: number;
  skipped: number;
  stale: number;
  errors: number;
  details: ReconcileDetail[];
}

export type EnvelopeFromMetadata = { ok: true; envelope: InboundEnvelope } | { ok: false; reason: string };

/** Rebuild the worker payload from R2 customMetadata and validate it like the webhook does. */
export function envelopeFromMetadata(object: R2ObjectInfo, meta: Record<string, string>): EnvelopeFromMetadata {
  const rawSize = meta.raw_size !== undefined ? Number(meta.raw_size) : object.size;
  const parsed = parseWorkerPayload({
    from: meta.from,
    to: meta.to,
    subject: meta.subject,
    message_id: meta.message_id,
    in_reply_to: meta.in_reply_to,
    references: meta.references,
    r2_key: object.key,
    raw_size: Number.isFinite(rawSize) ? rawSize : null,
    received_at: meta.received_at || object.lastModified || undefined,
  });
  return parsed.ok ? { ok: true, envelope: parsed.data } : { ok: false, reason: parsed.error };
}

function outcomeOf(result: IngestResult): { outcome: ReconcileOutcome; reason?: string } {
  switch (result.kind) {
    case 'duplicate':
      return { outcome: 'duplicate' };
    case 'no_user':
      return { outcome: 'skipped', reason: `no user for ${result.to_email}` };
    default:
      return { outcome: 'ingested' };
  }
}

export async function reconcileInbound(deps: ReconcileDeps): Promise<ReconcileSummary> {
  const log = deps.log ?? defaultLog;
  const now = (deps.now ?? (() => new Date()))().getTime();
  const minAgeMs = (deps.minAgeMinutes ?? DEFAULT_MIN_AGE_MINUTES) * 60_000;
  const maxAgeMs = (deps.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS) * 86_400_000;

  const maxIngest = deps.maxIngest ?? DEFAULT_MAX_INGEST;
  let attempted = 0;
  const summary: ReconcileSummary = { scanned: 0, ingested: 0, duplicates: 0, skipped: 0, stale: 0, errors: 0, details: [] };
  const objects = (await deps.list()).sort((a, b) => a.lastModified.localeCompare(b.lastModified));

  for (const object of objects) {
    summary.scanned += 1;
    const age = now - new Date(object.lastModified).getTime();
    if (Number.isFinite(age) && age < minAgeMs) {
      summary.details.push({ key: object.key, outcome: 'in_flight' });
      continue;
    }
    if (Number.isFinite(age) && age > maxAgeMs) {
      summary.stale += 1;
      summary.details.push({ key: object.key, outcome: 'stale', reason: `older than ${deps.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS} days` });
      continue;
    }

    if (attempted >= maxIngest) {
      summary.details.push({ key: object.key, outcome: 'deferred', reason: `limit of ${maxIngest} per run` });
      continue;
    }
    attempted += 1;

    try {
      const built = envelopeFromMetadata(object, await deps.head(object.key));
      if (!built.ok) {
        summary.skipped += 1;
        summary.details.push({ key: object.key, outcome: 'skipped', reason: `metadata: ${built.reason}` });
        continue;
      }
      const { outcome, reason } = outcomeOf(await deps.ingest(built.envelope));
      if (outcome === 'ingested') summary.ingested += 1;
      else if (outcome === 'duplicate') summary.duplicates += 1;
      else summary.skipped += 1;
      summary.details.push({ key: object.key, outcome, reason });
    } catch (err) {
      summary.errors += 1;
      summary.details.push({ key: object.key, outcome: 'error', reason: err instanceof Error ? err.message : String(err) });
      log.error('inbound.reconcile_error', { key: object.key, error: err });
    }
  }

  const { details: _details, ...counts } = summary;
  log.info('inbound.reconciled', counts);
  return summary;
}
