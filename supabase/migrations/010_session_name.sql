-- ============================================
-- Migration 010: Add name to request_sessions
-- Stores the user's formulated problem as session name
-- ============================================

ALTER TABLE public.request_sessions
  ADD COLUMN name TEXT;
