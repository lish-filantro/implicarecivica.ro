/**
 * POST /api/webhooks/cloudflare-email — called by cloudflare-email-worker after
 * it stored the raw email in R2. Requires CLOUDFLARE_EMAIL_WEBHOOK_SECRET.
 * Implementation: src/manager-544/inbound.
 */
import { createInboundWebhookHandler } from '@m544/inbound/handler';
import { createInboundDeps } from '@m544/inbound/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = createInboundWebhookHandler(createInboundDeps);
