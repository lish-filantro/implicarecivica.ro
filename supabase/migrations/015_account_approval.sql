-- ============================================
-- Migration 015: Account Approval (Whitelist)
-- implicarecivica.ro
-- ============================================

-- 1. Add approved column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: approve all existing accounts
UPDATE public.profiles SET approved = true WHERE approved = false;

-- 3. Add RLS policies that check approved status
-- These prevent unapproved users from accessing platform data

-- Requests: only approved users can insert
CREATE POLICY "Only approved users can create requests"
  ON public.requests FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- Conversations: only approved users can insert
CREATE POLICY "Only approved users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- Messages: only approved users can insert
CREATE POLICY "Only approved users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- Request sessions: only approved users can insert
CREATE POLICY "Only approved users can create sessions"
  ON public.request_sessions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- Feedback: only approved users can insert
CREATE POLICY "Only approved users can create feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );
