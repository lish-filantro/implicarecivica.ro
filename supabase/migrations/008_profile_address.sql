-- Migration 008: Profile Address
-- Adds address field for auto-fill in request wizard (saved optionally by user)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
