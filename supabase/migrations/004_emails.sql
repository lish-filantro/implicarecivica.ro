-- ============================================
-- Migration 004: Emails
-- implicarecivica.ro
-- ============================================

-- 1. Emails table (sent/received via Resend)
CREATE TABLE public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  parent_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,

  -- Email identification
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sent', 'received')),
  category TEXT CHECK (category IN ('trimise', 'inregistrate', 'amanate', 'raspunse', 'intarziate')),

  -- Email headers
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  attachments JSONB DEFAULT '[]',

  -- File storage
  pdf_file_path TEXT,

  -- OCR
  ocr_text TEXT,
  ocr_processed BOOLEAN NOT NULL DEFAULT false,
  ocr_processed_at TIMESTAMPTZ,

  -- AI Analysis
  ai_extracted_data JSONB DEFAULT '{}',
  registration_number TEXT,

  -- Processing
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,

  -- Metadata
  is_read BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate emails per user
  UNIQUE(user_id, message_id)
);

-- 2. Indexes
CREATE INDEX idx_emails_user_id ON public.emails(user_id);
CREATE INDEX idx_emails_request_id ON public.emails(request_id);
CREATE INDEX idx_emails_parent_email_id ON public.emails(parent_email_id);
CREATE INDEX idx_emails_message_id ON public.emails(message_id);
CREATE INDEX idx_emails_category ON public.emails(category);
CREATE INDEX idx_emails_processing_status ON public.emails(processing_status);
CREATE INDEX idx_emails_is_read ON public.emails(is_read) WHERE is_read = false;

-- 3. RLS
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emails"
  ON public.emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own emails"
  ON public.emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emails"
  ON public.emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emails"
  ON public.emails FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Updated_at trigger
CREATE TRIGGER on_emails_updated
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can access their own attachments
CREATE POLICY "Users can upload own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
