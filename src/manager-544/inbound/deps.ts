/**
 * Real dependencies for the inbound webhooks.
 */
import { after } from 'next/server';
import { createServiceClient } from '@m544/shared/db/clients';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';
import { SupabaseProfilesRepo } from '@m544/shared/db/profiles-repo';
import { SupabaseStorageRepo } from '@m544/shared/db/storage-repo';
import { processEmail } from '@m544/pipeline/process-email';
import { createPipelineDeps } from '@m544/pipeline/deps';
import { fetchRawEmail, deleteRawEmail } from './webhook/r2';
import { SupabaseCampaignAdapter } from './campaign-adapter';
import type { InboundDeps } from './ingest';

export function createInboundDeps(): InboundDeps {
  const sb = createServiceClient();
  return {
    emails: new SupabaseEmailsRepo(sb),
    profiles: new SupabaseProfilesRepo(sb),
    storage: new SupabaseStorageRepo(sb),
    campaigns: new SupabaseCampaignAdapter(sb),
    fetchRaw: (key) => fetchRawEmail(key),
    deleteRaw: (key) => deleteRawEmail(key),
    processEmail: (emailId) => processEmail(emailId, createPipelineDeps()),
    after: (task) => after(task),
  };
}
