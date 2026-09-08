-- ============================================
-- Migration 016: Refactor hardening (manager 544)
-- implicarecivica.ro — 2026-09-08
--
-- Run manually in Supabase Dashboard -> SQL Editor (see supabase/migrations/README.md).
-- Idempotent: safe to run more than once.
-- ============================================

-- 1. Approval enforcement in RLS
--    Migration 015 ADDED "only approved" INSERT policies next to the original
--    permissive ones. Postgres combines permissive policies with OR, so the
--    original policies still let unapproved users insert. Replace both with a
--    single policy per table that requires ownership AND approval.

DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
DROP POLICY IF EXISTS "Only approved users can create requests" ON public.requests;
CREATE POLICY "Approved users can create their own requests"
  ON public.requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Only approved users can create conversations" ON public.conversations;
CREATE POLICY "Approved users can create their own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Only approved users can create messages" ON public.messages;
CREATE POLICY "Approved users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Users can create own sessions" ON public.request_sessions;
DROP POLICY IF EXISTS "Only approved users can create sessions" ON public.request_sessions;
CREATE POLICY "Approved users can create their own sessions"
  ON public.request_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Only approved users can create feedback" ON public.feedback;
CREATE POLICY "Approved users can insert their own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- Users could also insert emails directly (policy from 004). The app only
-- inserts emails server-side (send route / webhooks with service role), so
-- restrict the client path to approved users as well.
DROP POLICY IF EXISTS "Users can create own emails" ON public.emails;
CREATE POLICY "Approved users can create their own emails"
  ON public.emails FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
  );

-- 2. New email categories: irrelevant (not a 544 answer) and redirected
ALTER TABLE public.emails DROP CONSTRAINT IF EXISTS emails_category_check;
ALTER TABLE public.emails ADD CONSTRAINT emails_category_check
  CHECK (category IN ('trimise', 'inregistrate', 'amanate', 'raspunse', 'intarziate', 'irelevant', 'redirectionat'));

-- 3. Manual-review flag for emails the matcher could not attribute with confidence
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_emails_needs_review
  ON public.emails(user_id) WHERE needs_review = true;

-- 4. Institution a request was redirected to (category 'redirectionat')
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS redirected_to TEXT;

-- 5. Indexes for the hot queries
--    daily rate limit: requests by user + institution + date_sent
CREATE INDEX IF NOT EXISTS idx_requests_rate_limit
  ON public.requests(user_id, institution_email, date_sent);
--    batch processing / inbox: emails by user + processing_status
CREATE INDEX IF NOT EXISTS idx_emails_user_processing
  ON public.emails(user_id, processing_status);
--    overdue check: open requests by effective deadline
CREATE INDEX IF NOT EXISTS idx_requests_open_deadline
  ON public.requests(deadline_date) WHERE status NOT IN ('answered', 'delayed');
CREATE INDEX IF NOT EXISTS idx_requests_open_extension
  ON public.requests(extension_date) WHERE status NOT IN ('answered', 'delayed');

-- 6. Verification queries (run after the migration; expected: one INSERT policy per table)
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND cmd = 'INSERT' ORDER BY tablename, policyname;
