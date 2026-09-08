/**
 * Real dependencies for the reconcile cron: the same ingestion deps as the
 * webhook, except `after` runs immediately (there is no response to defer
 * behind) so raw deletion + processing finish inside the cron invocation.
 */
import { createInboundDeps } from '../deps';
import { ingestEnvelope } from '../ingest';
import { listInboundObjects, headObjectMetadata } from './r2-list';
import type { ReconcileDeps } from './reconcile';

export function createReconcileDeps(): ReconcileDeps {
  const inbound = { ...createInboundDeps(), after: (task: () => Promise<void>) => task() };
  return {
    list: () => listInboundObjects(),
    head: (key) => headObjectMetadata(key),
    ingest: (env) => ingestEnvelope(env, inbound),
  };
}
