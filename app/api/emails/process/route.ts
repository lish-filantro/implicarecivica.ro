/**
 * POST /api/emails/process — run the inbound pipeline for one email ({ email_id })
 * or for a batch of pending ones ({ batch: true, limit? }). Requires CRON_SECRET.
 * Implementation: src/manager-544/pipeline.
 */
import { createProcessEmailHandler } from '@m544/pipeline/handlers';
import { createPipelineDeps } from '@m544/pipeline/deps';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = createProcessEmailHandler(createPipelineDeps);
