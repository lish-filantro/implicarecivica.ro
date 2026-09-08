import type { EmailCategory } from './request';

export type EmailType = 'sent' | 'received';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Email {
  id: string;
  user_id: string;
  request_id?: string | null;
  parent_email_id?: string | null;

  // Email identification
  message_id: string;
  type: EmailType;
  category?: EmailCategory | null;

  // Email headers
  from_email: string;
  to_email: string;
  subject: string;
  body?: string | null;
  attachments?: { name: string; size: number; type: string }[];

  // File storage
  pdf_file_path?: string | null;

  // OCR
  ocr_text?: string | null;
  ocr_processed: boolean;
  ocr_processed_at?: string | null;

  // AI Analysis
  ai_extracted_data?: Record<string, unknown>;
  registration_number?: string | null;

  // Processing
  processing_status: ProcessingStatus;
  retry_count: number;
  error_log?: string | null;

  // Set when the matcher could not attribute the email with confidence
  needs_review?: boolean;

  // Metadata
  is_read: boolean;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for sending an email via /api/emails/send
 */
export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  request_id?: string | null;
  parent_email_id?: string | null;
}

/**
 * Response from /api/emails/send
 */
export interface SendEmailResponse {
  success: boolean;
  email?: Email;
  resend_id?: string;
  error?: string;
}
