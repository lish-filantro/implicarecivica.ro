/**
 * Real dependencies for the daily cron. Reconciliation ingests without
 * processing inline (`processEmail` is a no-op) so the freshly inserted rows
 * stay `pending` and the batch step right after picks them up — one pipeline
 * pass per email, inside one function invocation.
 */
import { createInboundDeps } from '@m544/inbound/deps';
import { ingestEnvelope } from '@m544/inbound/ingest';
import { listInboundObjects, headObjectMetadata } from '@m544/inbound/reconcile/r2-list';
import { createPipelineDeps } from '@m544/pipeline/deps';
import type { DailyCronDeps } from './daily';

export function createDailyCronDeps(): DailyCronDeps {
  const inbound = {
    ...createInboundDeps(),
    after: (task: () => Promise<void>) => task(),
    processEmail: async () => undefined,
  };
  return {
    pipeline: createPipelineDeps(),
    reconcile: {
      list: () => listInboundObjects(),
      head: (key) => headObjectMetadata(key),
      ingest: (env) => ingestEnvelope(env, inbound),
    },
  };
}
