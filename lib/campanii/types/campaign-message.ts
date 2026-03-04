export interface CampaignMessage {
  id: string;
  campaign_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body: string | null;
  attachments: { name: string; type: string; size: number; path: string }[];
  is_read: boolean;
  received_at: string;
  created_at: string;
}
