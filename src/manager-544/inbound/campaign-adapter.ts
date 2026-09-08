/**
 * The single seam between the 544 inbound webhook and the campanii module.
 * Every campaign has its own inbox address; mail to it is either a
 * confirmation (subject == campaign template) or a message for the campaign inbox.
 * Behaviour is unchanged from the legacy webhook; only the wiring is isolated.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedAttachment } from './webhook/attachments';

export interface CampaignInbox {
  id: string;
  email_subject: string;
}

export interface CampaignMessageInput {
  campaignId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  attachments: SavedAttachment[];
  receivedAt: string;
}

export interface CampaignAdapter {
  /** Campaign (active or archived) owning this inbox address, or null. */
  findByInboxAddress(toEmail: string): Promise<CampaignInbox | null>;
  /** Count a BCC'd participation email as confirmed. */
  confirmParticipation(campaignId: string, fromEmail: string): Promise<boolean>;
  /** Store a non-template email in the campaign inbox. */
  saveMessage(input: CampaignMessageInput): Promise<void>;
}

export class SupabaseCampaignAdapter implements CampaignAdapter {
  constructor(private readonly sb: SupabaseClient) {}

  async findByInboxAddress(toEmail: string): Promise<CampaignInbox | null> {
    const { data, error } = await this.sb
      .from('campaigns')
      .select('id, email_subject')
      .eq('campaign_email', toEmail)
      .in('status', ['active', 'archived'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as CampaignInbox | undefined) ?? null;
  }

  async confirmParticipation(campaignId: string, fromEmail: string): Promise<boolean> {
    // Lazy import keeps lib/campanii out of the module graph unless a campaign matched.
    const { confirmParticipation } = await import('@/lib/campanii/participation-queries');
    return confirmParticipation(campaignId, fromEmail);
  }

  async saveMessage(input: CampaignMessageInput): Promise<void> {
    const { error } = await this.sb.from('campaign_messages').insert({
      campaign_id: input.campaignId,
      from_email: input.fromEmail,
      from_name: input.fromName,
      subject: input.subject,
      body: input.body,
      attachments: input.attachments.map(({ name, type, size, path }) => ({ name, type, size, path })),
      received_at: input.receivedAt,
    });
    if (error) throw error;
  }
}
