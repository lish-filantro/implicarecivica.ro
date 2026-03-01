-- ============================================
-- Migration 009: Campaign Email Module
-- implicarecivica.ro - Civic email campaigns
-- ============================================

-- 1. Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,
  cover_image_url TEXT,
  organization TEXT,

  -- Email template
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  email_signature TEXT,

  -- Form configuration
  submit_button_text TEXT DEFAULT 'Trimite emailul acum!',
  success_message TEXT DEFAULT 'Mulțumim! Emailul tău contează.',
  redirect_url TEXT,
  sending_method TEXT NOT NULL DEFAULT 'mailto'
    CHECK (sending_method IN ('mailto', 'resend')),
  form_fields JSONB DEFAULT '{"city": false, "postal_code": false, "custom_field": null}'::jsonb,
  gdpr_text TEXT DEFAULT 'Accept prelucrarea datelor conform GDPR pentru scopul acestei campanii.',

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  expires_at TIMESTAMPTZ,

  -- Counters (denormalized for fast reads)
  participation_count INT NOT NULL DEFAULT 0,
  confirmed_count INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique email_subject among active campaigns only
CREATE UNIQUE INDEX idx_campaigns_active_subject
  ON public.campaigns (email_subject)
  WHERE status = 'active';

CREATE INDEX idx_campaigns_slug ON public.campaigns(slug);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);

-- Auto-update updated_at (reuse existing trigger function from migration 001)
CREATE TRIGGER on_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Campaign Recipients table
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign
  ON public.campaign_recipients(campaign_id);

-- 3. Campaign Participations table
CREATE TABLE public.campaign_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT,
  participant_city TEXT,
  custom_field_value TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'confirmed')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_participations_campaign
  ON public.campaign_participations(campaign_id);
CREATE INDEX idx_campaign_participations_status
  ON public.campaign_participations(email_status);
CREATE INDEX idx_campaign_participations_ip
  ON public.campaign_participations(ip_hash, campaign_id);

-- 4. Campaign Email Events table (Phase 2 - Resend tracking)
CREATE TABLE public.campaign_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID REFERENCES public.campaign_participations(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_email_events_participation
  ON public.campaign_email_events(participation_id);

-- 5. RLS Policies
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_email_events ENABLE ROW LEVEL SECURITY;

-- Campaigns: public read for active, service role full access
CREATE POLICY "Anyone can read active campaigns"
  ON public.campaigns FOR SELECT
  USING (status = 'active');

CREATE POLICY "Service role manages campaigns"
  ON public.campaigns FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Recipients: public read for active campaign recipients
CREATE POLICY "Anyone can read active campaign recipients"
  ON public.campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_recipients.campaign_id
        AND campaigns.status = 'active'
    )
  );

CREATE POLICY "Service role manages recipients"
  ON public.campaign_recipients FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Participations: anyone can insert, only service role reads
CREATE POLICY "Anyone can insert participations"
  ON public.campaign_participations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role manages participations"
  ON public.campaign_participations FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Email events: service role only
CREATE POLICY "Service role manages email events"
  ON public.campaign_email_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 6. Function: increment participation count (atomic)
CREATE OR REPLACE FUNCTION public.increment_campaign_participation(
  p_campaign_id UUID,
  p_counter TEXT DEFAULT 'participation'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_counter = 'confirmed' THEN
    UPDATE public.campaigns
    SET confirmed_count = confirmed_count + 1
    WHERE id = p_campaign_id;
  ELSE
    UPDATE public.campaigns
    SET participation_count = participation_count + 1
    WHERE id = p_campaign_id;
  END IF;
END;
$$;

-- 7. Function: rate limit check
CREATE OR REPLACE FUNCTION public.check_campaign_rate_limit(
  p_campaign_id UUID,
  p_ip_hash TEXT,
  p_window_hours INT DEFAULT 24
)
RETURNS INT
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM public.campaign_participations
  WHERE campaign_id = p_campaign_id
    AND ip_hash = p_ip_hash
    AND created_at > now() - (p_window_hours || ' hours')::interval;
$$;
