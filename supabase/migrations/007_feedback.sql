-- ============================================
-- Migration 007: Feedback
-- implicarecivica.ro
-- User feedback for platform improvement
-- ============================================

-- 1. Feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Content
  category TEXT NOT NULL
    CHECK (category IN ('bug', 'sugestie', 'utilizare', 'altele')),
  message TEXT NOT NULL,
  page_url TEXT,

  -- Status (managed by admin)
  status TEXT NOT NULL DEFAULT 'nou'
    CHECK (status IN ('nou', 'in_lucru', 'rezolvat', 'respins')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);

-- 3. Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);
