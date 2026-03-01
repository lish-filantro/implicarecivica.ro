export type CampaignStatus = "draft" | "active" | "archived";
export type SendingMethod = "mailto" | "resend";
export type EmailStatus = "pending" | "confirmed";

export interface FormFieldsConfig {
  city: boolean;
  postal_code: boolean;
  custom_field: string | null;
}

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  long_description: string | null;
  cover_image_url: string | null;
  organization: string | null;
  email_subject: string;
  email_body: string;
  email_signature: string | null;
  submit_button_text: string;
  success_message: string | null;
  redirect_url: string | null;
  sending_method: SendingMethod;
  form_fields: FormFieldsConfig;
  gdpr_text: string;
  status: CampaignStatus;
  expires_at: string | null;
  participation_count: number;
  confirmed_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  name: string;
  role: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface CampaignParticipation {
  id: string;
  campaign_id: string;
  participant_name: string;
  participant_email: string | null;
  participant_city: string | null;
  custom_field_value: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  email_status: EmailStatus;
  confirmed_at: string | null;
  created_at: string;
}
