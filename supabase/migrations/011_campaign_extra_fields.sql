-- Add extra_fields JSONB column to campaign_participations
-- Stores extended participant data (profession, organization, phone, sector)
-- without requiring schema changes for each new field type

ALTER TABLE campaign_participations
ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;

-- Index for querying by extra fields (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_campaign_participations_extra_fields
ON campaign_participations USING GIN (extra_fields);
