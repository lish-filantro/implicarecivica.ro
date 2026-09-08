-- ============================================
-- Migration 017: Improvements (manager 544)
-- implicarecivica.ro — 2026-09-08
--
-- Run manually in Supabase Dashboard -> SQL Editor, AFTER 016.
-- Idempotent: safe to run more than once.
--
-- 1. classification_feedback  — user corrections of the AI email category
-- 2. deadline_notifications   — one digest entry per (user, request, kind, day)
-- 3. institutii_locale        — verified 544 addresses learned from received answers
-- ============================================

-- 1. Classification feedback -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_category TEXT,
  new_category TEXT NOT NULL CHECK (
    new_category IN ('trimise', 'inregistrate', 'amanate', 'raspunse', 'intarziate', 'irelevant', 'redirectionat')
  ),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_feedback_email ON public.classification_feedback(email_id);
CREATE INDEX IF NOT EXISTS idx_classification_feedback_created ON public.classification_feedback(created_at DESC);

ALTER TABLE public.classification_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert feedback on their own emails" ON public.classification_feedback;
CREATE POLICY "Users insert feedback on their own emails"
  ON public.classification_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.emails e WHERE e.id = email_id AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users read their own classification feedback" ON public.classification_feedback;
CREATE POLICY "Users read their own classification feedback"
  ON public.classification_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Deadline notifications (written only by the service role from the cron) --
CREATE TABLE IF NOT EXISTS public.deadline_notifications (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('upcoming', 'overdue')),
  sent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id, kind, sent_on)
);

ALTER TABLE public.deadline_notifications ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (bypasses RLS) reads/writes here.

-- 3. Verified local institution addresses ------------------------------------
CREATE TABLE IF NOT EXISTS public.institutii_locale (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nume_normalizat TEXT NOT NULL UNIQUE,
  nume TEXT NOT NULL,
  email TEXT NOT NULL,
  judet TEXT,
  localitate TEXT,
  sursa TEXT NOT NULL DEFAULT 'raspuns' CHECK (sursa IN ('raspuns', 'manual')),
  verificat_la TIMESTAMPTZ NOT NULL DEFAULT now(),
  nr_confirmari INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutii_locale_nume ON public.institutii_locale USING gin (to_tsvector('simple', nume));

ALTER TABLE public.institutii_locale ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: read/written by the service role (pipeline + chat tool).

-- Verification -----------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('classification_feedback', 'deadline_notifications', 'institutii_locale')
ORDER BY table_name;
