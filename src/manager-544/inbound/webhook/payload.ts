/**
 * Payload posted by cloudflare-email-worker/worker.js after it stored the raw
 * MIME message in R2. Validated with zod; normalized into the shape the
 * handler works with.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { extractEmail, stripAngleBrackets } from './addresses';

/** Keys the worker generates: `inbound/<timestamp>-<uuid>.eml` — never accept arbitrary paths. */
const R2_KEY_PATTERN = /^inbound\/[A-Za-z0-9._-]+$/;

export const workerPayloadSchema = z.object({
  from: z.string().min(3),
  to: z.string().min(3),
  subject: z.string().optional().nullable(),
  message_id: z.string().optional().nullable(),
  in_reply_to: z.string().optional().nullable(),
  references: z.string().optional().nullable(),
  r2_key: z.string().regex(R2_KEY_PATTERN, 'r2_key must look like inbound/<file>'),
  raw_size: z.number().int().nonnegative().optional().nullable(),
  received_at: z.string().optional().nullable(),
});

export type WorkerPayload = z.infer<typeof workerPayloadSchema>;

export interface InboundEnvelope {
  /** Raw From header as received (kept for display in the inbox). */
  from: string;
  from_email: string;
  to_email: string;
  subject: string;
  message_id: string;
  in_reply_to: string | undefined;
  references: string | undefined;
  r2_key: string;
  raw_size: number | null;
  received_at: string;
}

export const DEFAULT_SUBJECT = '(fără subiect)';

export type ParsedPayload = { ok: true; data: InboundEnvelope } | { ok: false; error: string };

export function parseWorkerPayload(raw: unknown): ParsedPayload {
  const parsed = workerPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error };
  }
  const p = parsed.data;
  const messageId = p.message_id ? stripAngleBrackets(p.message_id) : '';
  return {
    ok: true,
    data: {
      from: p.from,
      from_email: extractEmail(p.from),
      to_email: extractEmail(p.to),
      subject: p.subject?.trim() || DEFAULT_SUBJECT,
      message_id: messageId || randomUUID(),
      in_reply_to: p.in_reply_to ? stripAngleBrackets(p.in_reply_to) || undefined : undefined,
      references: p.references?.trim() || undefined,
      r2_key: p.r2_key,
      raw_size: p.raw_size ?? null,
      received_at: p.received_at || new Date().toISOString(),
    },
  };
}
