/**
 * POST /api/webhooks/resend — delivery events (delivered/bounced/complained)
 * for emails sent through Resend. Svix signature required (RESEND_WEBHOOK_SECRET).
 * Inbound mail is NOT handled here (Cloudflare Email Worker).
 */
import { createResendWebhookHandler } from '@m544/inbound/resend/handler';
import { createServiceClient } from '@m544/shared/db/clients';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';

export const dynamic = 'force-dynamic';

export const POST = createResendWebhookHandler(() => ({ emails: new SupabaseEmailsRepo(createServiceClient()) }));
