/**
 * POST /api/webhooks/cloudflare-email
 *
 * Called by cloudflare-email-worker after it stored the raw MIME in R2:
 *   auth (shared secret) → payload → campaign inbox? → user inbox:
 *   fetch raw → parse → owner → thread → attachments → insert → after():
 *   delete raw from R2 + run the processing pipeline.
 */
import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireWebhookSecret } from '@m544/shared/auth';
import { json, httpError, withErrorBoundary } from '@m544/shared/http';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { ProfilesRepo } from '@m544/shared/db/profiles-repo';
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import { parseWorkerPayload, type InboundEnvelope } from './webhook/payload';
import { cleanReplySubject, extractName } from './webhook/addresses';
import { parseMime, type ParsedMime } from './webhook/mime';
import { saveAttachments, pickPdfPath } from './webhook/attachments';
import { detectParentEmail } from './webhook/thread';
import { resolveRecipientUser } from './webhook/user-lookup';
import type { CampaignAdapter } from './campaign-adapter';

export interface InboundDeps {
  emails: EmailsRepo;
  profiles: ProfilesRepo;
  storage: StorageRepo;
  campaigns: CampaignAdapter;
  fetchRaw: (r2Key: string) => Promise<Uint8Array>;
  deleteRaw: (r2Key: string) => Promise<void>;
  /** Runs the processing pipeline for a stored email (default: in-process). */
  processEmail: (emailId: string) => Promise<unknown>;
  /** Schedules work after the response is sent (default: next/server `after`). */
  after: (task: () => Promise<void>) => void;
}

async function handleCampaign(env: InboundEnvelope, deps: InboundDeps) {
  const campaign = await deps.campaigns.findByInboxAddress(env.to_email);
  if (!campaign) return null;

  if (cleanReplySubject(env.subject) === campaign.email_subject) {
    // BCC copy of a participation email → confirmed, no need to download the body.
    await deps.campaigns.confirmParticipation(campaign.id, env.from_email);
    deps.after(() => deps.deleteRaw(env.r2_key));
    return json({ received: true, campaign_counted: true, campaign_id: campaign.id });
  }

  const parsed = await parseMime(await deps.fetchRaw(env.r2_key));
  const messageId = randomUUID();
  const attachments = await saveAttachments(parsed.attachments, {
    ownerPrefix: `campaign-${campaign.id}`,
    emailId: messageId,
    storage: deps.storage,
  });
  await deps.campaigns.saveMessage({
    campaignId: campaign.id,
    fromEmail: env.from_email,
    fromName: extractName(env.from),
    subject: env.subject,
    body: parsed.body,
    attachments,
    receivedAt: env.received_at,
  });
  deps.after(() => deps.deleteRaw(env.r2_key));
  return json({ received: true, campaign_message_saved: true, campaign_id: campaign.id });
}

async function handleUserEmail(env: InboundEnvelope, deps: InboundDeps) {
  const raw = await deps.fetchRaw(env.r2_key);
  const parsed: ParsedMime = await parseMime(raw);

  const userId = await resolveRecipientUser(env.to_email, deps);
  if (!userId) {
    console.warn(`[CF Email] No user found for ${env.to_email}`);
    return json({ received: true, matched: false });
  }

  const parentEmailId = await detectParentEmail({ inReplyTo: env.in_reply_to, references: env.references }, deps.emails);
  const emailId = randomUUID();
  const attachments = await saveAttachments(parsed.attachments, { ownerPrefix: userId, emailId, storage: deps.storage });

  const inserted = await deps.emails.insert({
    id: emailId,
    user_id: userId,
    parent_email_id: parentEmailId,
    message_id: env.message_id,
    type: 'received',
    from_email: env.from,
    to_email: env.to_email,
    subject: env.subject,
    body: parsed.body,
    attachments,
    pdf_file_path: pickPdfPath(attachments),
    processing_status: 'pending',
    is_read: false,
    received_at: env.received_at,
  });
  if (!inserted.ok) return json({ received: true, duplicate: true });

  deps.after(async () => {
    await deps.deleteRaw(env.r2_key);
    try {
      await deps.processEmail(emailId);
    } catch (err) {
      console.error(`[CF Email] Processing failed for ${emailId}:`, err instanceof Error ? err.message : err);
    }
  });

  return json({
    received: true,
    matched: true,
    email_id: emailId,
    has_body: parsed.body.length > 0,
    attachments: attachments.length,
    has_parent: parentEmailId !== null,
    processing: 'triggered',
  });
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

    const deps = getDeps();
    console.log(`[CF Email] from=${payload.data.from_email} to=${payload.data.to_email} r2=${payload.data.r2_key}`);

    const campaignResponse = await handleCampaign(payload.data, deps);
    if (campaignResponse) return campaignResponse;
    return handleUserEmail(payload.data, deps);
  }, 'webhooks/cloudflare-email');
}
