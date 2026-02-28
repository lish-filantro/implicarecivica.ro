import type { EmailCategory } from './request';

export type EmailType = 'sent' | 'received';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Email {
  id: string;
  user_id: string;
  request_id?: string;
  parent_email_id?: string;

  // Email identification
  message_id: string;
  type: EmailType;
  category?: EmailCategory;

  // Email headers
  from_email: string;
  to_email: string;
  subject: string;
  body?: string;
  attachments?: { name: string; size: number; type: string }[];

  // File storage
  pdf_file_path?: string;

  // OCR
  ocr_text?: string;
  ocr_processed: boolean;
  ocr_processed_at?: string;

  // AI Analysis
  ai_extracted_data?: Record<string, unknown>;
  registration_number?: string;

  // Processing
  processing_status: ProcessingStatus;
  retry_count: number;
  error_log?: string;

  // Metadata
  is_read: boolean;
  received_at?: string;
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
  request_id?: string;
  parent_email_id?: string;
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
