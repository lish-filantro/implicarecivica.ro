-- ============================================
-- Migration 014: Per-campaign email + inbox
-- Each campaign gets its own email address for
-- BCC tracking and inbound message collection.
-- ============================================

-- 1. Add campaign_email column to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN campaign_email TEXT;

-- Unique email among active campaigns
CREATE UNIQUE INDEX idx_campaigns_active_email
  ON public.campaigns (campaign_email)
  WHERE status = 'active';

-- 2. Campaign messages table (inbox for non-matching subjects)
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_messages_campaign
  ON public.campaign_messages(campaign_id);
CREATE INDEX idx_campaign_messages_unread
  ON public.campaign_messages(campaign_id, is_read)
  WHERE is_read = false;

-- 3. RLS
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages campaign messages"
  ON public.campaign_messages FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
