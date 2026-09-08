/**
 * POST /api/webhooks/cloudflare-email
 *
 * Called by cloudflare-email-worker after it stored the raw MIME in R2:
 *   auth (shared secret) → payload → ingestEnvelope → JSON result.
 */
import type { NextRequest } from 'next/server';
import { requireWebhookSecret } from '@m544/shared/auth';
import { json, httpError, withErrorBoundary } from '@m544/shared/http';
import { parseWorkerPayload } from './webhook/payload';
import { ingestEnvelope, type InboundDeps, type IngestResult } from './ingest';

export type { InboundDeps, IngestResult } from './ingest';

/** Response body keys are read in the worker's logs; keep them stable. */
export function toResponseBody(result: IngestResult): Record<string, unknown> {
  switch (result.kind) {
    case 'campaign_counted':
      return { campaign_counted: true, campaign_id: result.campaign_id };
    case 'campaign_message_saved':
      return { campaign_message_saved: true, campaign_id: result.campaign_id };
    case 'no_user':
      return { matched: false };
    case 'duplicate':
      return { duplicate: true };
    case 'ingested':
      return {
        matched: true,
        email_id: result.email_id,
        has_body: result.has_body,
        attachments: result.attachments,
        has_parent: result.has_parent,
        processing: 'triggered',
      };
  }
}

export function createInboundWebhookHandler(getDeps: () => InboundDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const guard = requireWebhookSecret(request);
    if (!guard.ok) return guard.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return httpError(400, 'Body JSON invalid');
    }
    const payload = parseWorkerPayload(raw);
    if (!payload.ok) return httpError(400, `Payload invalid: ${payload.error}`);

    const result = await ingestEnvelope(payload.data, getDeps());
    return json({ received: true, ...toResponseBody(result) });
  }, 'webhooks/cloudflare-email');
}
