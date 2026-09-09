-- ============================================
-- Migration 018: Conversation hand-off (manager 544)
-- implicarecivica.ro — 2026-09-09
--
-- Run manually in Supabase Dashboard -> SQL Editor, AFTER 017.
-- Idempotent: safe to run more than once.
--
-- conversations.handoff — the institution identified by the assistant, its
-- confirmation by the user, the request session created from it and the
-- generated-question cache. Written by the browser client (RLS: owner only)
-- and by POST /api/questions/generate-set (user client, RLS).
-- ============================================

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS handoff JSONB;

COMMENT ON COLUMN public.conversations.handoff IS
  'Chat → wizard hand-off: institution, email confidence, confirmation, session id, generated questions';
