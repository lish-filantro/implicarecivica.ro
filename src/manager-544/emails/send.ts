/**
 * POST /api/emails/send — send a 544 request (or a reply) from the user's
 * platform address via Resend, record it and update the linked request.
 *
 *   auth → body (zod) → sender identity → request ownership → daily limit →
 *   Resend → insert `sent` row → mark request pending/sent
 *
 * The daily per-institution limit is enforced on EVERY send (the legacy route
 * only checked it when request_id was present).
 */
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { createServerClient } from '@m544/shared/db/clients';
import { checkDailyLimit, SupabaseSentCounter, type SentCounter } from '@m544/shared/rate-limit';
import type { Email } from '@m544/shared/types/email';
import { getResend } from './resend-client';
import { SupabaseSendStore, type SendStore } from './store';

export interface OutgoingEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  headers: Record<string, string>;
}

export interface SendResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

/** The slice of the Resend API we use (`new Resend(key).emails` satisfies it). */
export interface EmailSender {
  send(payload: OutgoingEmail): Promise<SendResult>;
}

export interface SendEmailDeps<C extends AuthClient = SupabaseClient> {
  /** Session client: authenticates the caller and scopes every query by RLS. */
  createClient: () => Promise<C>;
  store: (sb: C) => SendStore;
  counter: (sb: C) => SentCounter;
  resend: EmailSender;
  now?: () => Date;
}

const bodySchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  request_id: z.string().uuid().nullish(),
  parent_email_id: z.string().uuid().nullish(),
});

export type SendEmailBody = z.infer<typeof bodySchema>;

export const NO_PLATFORM_ADDRESS = 'Nu ai o adresă de email de platformă asociată contului. Contactează suportul.';
export const REQUEST_NOT_FOUND = 'Cererea nu a fost găsită';
export const DB_SAVE_WARNING = 'Email trimis, dar nu a fost salvat în baza de date';

export function createSendEmailHandler<C extends AuthClient>(getDeps: () => SendEmailDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const now = deps.now ?? (() => new Date());

    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;
    const { user, supabase } = guard;

    const parsed = await parseJsonBody(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { to, subject, body, request_id, parent_email_id } = parsed.data;

    const store = deps.store(supabase);
    const identity = await store.getSenderIdentity(user.id);
    if (!identity?.mailcow_email) return httpError(400, NO_PLATFORM_ADDRESS);

    if (request_id && !(await store.ownsRequest(request_id, user.id))) {
      return httpError(404, REQUEST_NOT_FOUND);
    }

    const limit = await checkDailyLimit(user.id, { email: to, name: to }, 1, deps.counter(supabase), now);
    if (!limit.ok) {
      return httpError(429, `Limita zilnică de ${limit.limit} cereri către această adresă a fost atinsă.`);
    }

    const sent = await deps.resend.send({
      from: `${identity.display_name || 'Utilizator'} <${identity.mailcow_email}>`,
      to: [to],
      subject,
      html: body,
      headers: request_id ? { 'X-Request-ID': request_id } : {},
    });
    if (sent.error) {
      console.error('[emails/send] Resend error:', sent.error.message);
      return httpError(500, `Eroare la trimitere: ${sent.error.message}`);
    }
    const resendId = sent.data?.id;

    let email: Email;
    try {
      email = await store.insertSentEmail({
        user_id: user.id,
        request_id: request_id ?? null,
        parent_email_id: parent_email_id ?? null,
        message_id: resendId ?? randomUUID(),
        from_email: identity.mailcow_email,
        to_email: to,
        subject,
        body,
      });
    } catch (err) {
      console.error('[emails/send] DB error (email sent but not saved):', err instanceof Error ? err.message : err);
      return json({ success: true, resend_id: resendId, warning: DB_SAVE_WARNING });
    }

    if (request_id) await store.markRequestSent(request_id, user.id, now().toISOString());

    return json({ success: true, email, resend_id: resendId });
  }, 'emails/send');
}

/** Real dependencies: session client + Resend SDK (key read lazily, per request). */
export function createSendEmailDeps(): SendEmailDeps {
  return {
    createClient: createServerClient,
    store: (sb) => new SupabaseSendStore(sb),
    counter: (sb) => new SupabaseSentCounter(sb),
    get resend() {
      return getResend().emails;
    },
  };
}
