/**
 * Ingest one inbound envelope (the worker's payload, or one rebuilt from R2
 * metadata by the reconcile cron): campaign inbox? → else user inbox:
 * fetch raw → parse → owner → thread → attachments → insert → after():
 * delete raw from R2 + run the processing pipeline.
 *
 * Returns a result object; the HTTP shape is the handler's business.
 * The raw object in R2 is deleted only after a successful insert or a
 * duplicate; on `no_user` it is kept so an address typo can be investigated.
 */
import { randomUUID } from 'node:crypto';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { ProfilesRepo } from '@m544/shared/db/profiles-repo';
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import { log as defaultLog, type Logger } from '@m544/shared/log';
import type { InboundEnvelope } from './webhook/payload';
import { cleanReplySubject, extractName } from './webhook/addresses';
import { parseMime } from './webhook/mime';
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
  /**
   * Schedules work after the response is sent (webhook: next/server `after`).
   * The reconcile cron runs the task immediately and returns its promise.
   */
  after: (task: () => Promise<void>) => void | Promise<void>;
  log?: Logger;
}

export type IngestResult =
  | { kind: 'campaign_counted'; campaign_id: string }
  | { kind: 'campaign_message_saved'; campaign_id: string }
  | { kind: 'no_user'; to_email: string }
  | { kind: 'duplicate'; message_id: string }
  | { kind: 'ingested'; email_id: string; attachments: number; has_parent: boolean; has_body: boolean };

async function ingestCampaign(env: InboundEnvelope, deps: InboundDeps): Promise<IngestResult | null> {
  const campaign = await deps.campaigns.findByInboxAddress(env.to_email);
  if (!campaign) return null;

  if (cleanReplySubject(env.subject) === campaign.email_subject) {
    // BCC copy of a participation email → confirmed, no need to download the body.
    await deps.campaigns.confirmParticipation(campaign.id, env.from_email);
    await deps.after(() => deps.deleteRaw(env.r2_key));
    return { kind: 'campaign_counted', campaign_id: campaign.id };
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
  await deps.after(() => deps.deleteRaw(env.r2_key));
  return { kind: 'campaign_message_saved', campaign_id: campaign.id };
}

async function ingestUserEmail(env: InboundEnvelope, deps: InboundDeps, log: Logger): Promise<IngestResult> {
  const userId = await resolveRecipientUser(env.to_email, deps);
  if (!userId) {
    log.warn('inbound.no_user', { to: env.to_email, from: env.from_email, r2_key: env.r2_key });
    return { kind: 'no_user', to_email: env.to_email };
  }

  const parsed = await parseMime(await deps.fetchRaw(env.r2_key));
  const parentEmailId = await detectParentEmail({ inReplyTo: env.in_reply_to, references: env.references }, deps.emails);
  const emailId = randomUUID();
  const attachments = await saveAttachments(parsed.attachments, { ownerPrefix: userId, emailId, storage: deps.storage });

  const inserted = await deps.emails.insert({
    id: emailId,
    user_id: userId,
    parent_email_id: parentEmailId,
    message_id: env.message_id,
    type: 'received',
    // Header From over the SMTP envelope sender: relays (Resend/SES, forwarders) use
    // technical bounce addresses in the envelope, while matching and address learning
    // need the institution's real address.
    from_email: parsed.from?.address ?? env.from,
    to_email: env.to_email,
    subject: env.subject,
    body: parsed.body,
    attachments,
    pdf_file_path: pickPdfPath(attachments),
    processing_status: 'pending',
    is_read: false,
    received_at: env.received_at,
  });
  if (!inserted.ok) {
    log.info('inbound.duplicate', { message_id: env.message_id, user_id: userId, r2_key: env.r2_key });
    await deps.after(() => deps.deleteRaw(env.r2_key));
    return { kind: 'duplicate', message_id: env.message_id };
  }

  log.info('inbound.ingested', {
    email_id: emailId,
    user_id: userId,
    attachments: attachments.length,
    has_parent: parentEmailId !== null,
  });
  await deps.after(async () => {
    await deps.deleteRaw(env.r2_key);
    try {
      await deps.processEmail(emailId);
    } catch (err) {
      log.error('inbound.process_failed', { email_id: emailId, error: err });
    }
  });

  return {
    kind: 'ingested',
    email_id: emailId,
    attachments: attachments.length,
    has_parent: parentEmailId !== null,
    has_body: parsed.body.length > 0,
  };
}

export async function ingestEnvelope(env: InboundEnvelope, deps: InboundDeps): Promise<IngestResult> {
  const log = deps.log ?? defaultLog;
  return (await ingestCampaign(env, deps)) ?? ingestUserEmail(env, deps, log);
}
