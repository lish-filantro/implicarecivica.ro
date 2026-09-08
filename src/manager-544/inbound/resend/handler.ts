/**
 * POST /api/webhooks/resend — delivery events for emails WE sent through Resend.
 *
 * Inbound mail is handled exclusively by the Cloudflare Email Worker, so
 * `email.received` is acknowledged and ignored here. Every request must carry a
 * valid Svix signature (RESEND_WEBHOOK_SECRET); unsigned requests are rejected.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSecret } from '@m544/shared/env';
import { json, httpError, withErrorBoundary } from '@m544/shared/http';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import { verifySvixSignature } from './signature';

export interface ResendDeps {
  emails: EmailsRepo;
  now?: () => Date;
}

const eventSchema = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().optional(),
      bounce: z.object({ type: z.string().optional() }).partial().optional(),
    })
    .passthrough()
    .optional(),
});

const DELIVERY_STATUS: Record<string, 'completed' | 'failed'> = {
  'email.delivered': 'completed',
  'email.bounced': 'failed',
  'email.complained': 'failed',
};

export function createResendWebhookHandler(getDeps: () => ResendDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const secret = requireSecret('RESEND_WEBHOOK_SECRET');
    const rawBody = await request.text();
    const deps = getDeps();

    const verdict = verifySvixSignature(request.headers, rawBody, secret, deps.now);
    if (!verdict.ok) {
      console.warn(`[Resend] rejected webhook: ${verdict.reason}`);
      return httpError(401, 'Invalid signature');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return httpError(400, 'Body JSON invalid');
    }
    const event = eventSchema.safeParse(parsedJson);
    if (!event.success) return httpError(400, 'Eveniment invalid');

    const { type, data } = event.data;

    if (type === 'email.received') {
      return json({ received: true, ignored: 'inbound email is handled by the Cloudflare Email Worker' });
    }

    const status = DELIVERY_STATUS[type];
    if (!status) return json({ received: true, unhandled: type });

    const messageId = data?.email_id;
    if (!messageId) return json({ received: true, unhandled: `${type} without email_id` });

    const emailId = await deps.emails.findIdByMessageId(messageId);
    if (!emailId) return json({ received: true, matched: false });

    await deps.emails.update(emailId, {
      processing_status: status,
      error_log: type === 'email.bounced' ? `Bounce: ${data?.bounce?.type ?? 'unknown'}` : null,
    });
    return json({ received: true, matched: true, status });
  }, 'webhooks/resend');
}
