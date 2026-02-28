-- ============================================
-- Migration 006: Request Sessions
-- implicarecivica.ro
-- Groups multiple requests under one subject/institution
-- ============================================

-- 1. Request Sessions table
CREATE TABLE public.request_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

  -- Core
  subject TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_email TEXT,

  -- Cache (derived from requests, updated via trigger)
  cached_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (cached_status IN (
      'pending',            -- all sent, no response yet
      'in_progress',        -- at least 1 registration confirmation
      'partial_answered',   -- some answered, some not
      'completed',          -- all answered
      'overdue'             -- at least 1 deadline exceeded without answer
    )),
  total_requests INTEGER NOT NULL DEFAULT 0,
  answered_requests INTEGER NOT NULL DEFAULT 0,
  nearest_deadline TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add session_id to requests
ALTER TABLE public.requests
  ADD COLUMN session_id UUID REFERENCES public.request_sessions(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX idx_request_sessions_user_id ON public.request_sessions(user_id);
CREATE INDEX idx_request_sessions_cached_status ON public.request_sessions(cached_status);
CREATE INDEX idx_request_sessions_conversation_id ON public.request_sessions(conversation_id);
CREATE INDEX idx_requests_session_id ON public.requests(session_id);

-- 4. RLS
ALTER TABLE public.request_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.request_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.request_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.request_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.request_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Updated_at trigger
CREATE TRIGGER on_request_sessions_updated
  BEFORE UPDATE ON public.request_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Recalculate session status function
CREATE OR REPLACE FUNCTION public.recalculate_session_status(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_answered INTEGER;
  v_has_overdue BOOLEAN;
  v_has_received BOOLEAN;
  v_nearest TIMESTAMPTZ;
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'answered'),
    BOOL_OR(status = 'delayed'),
    BOOL_OR(status = 'received'),
    MIN(COALESCE(extension_date, deadline_date))
      FILTER (WHERE status NOT IN ('answered'))
  INTO v_total, v_answered, v_has_overdue, v_has_received, v_nearest
  FROM public.requests
  WHERE session_id = p_session_id;

  -- Priority: overdue > partial_answered > in_progress > pending
  IF v_total = 0 THEN
    v_new_status := 'pending';
  ELSIF v_answered = v_total THEN
    v_new_status := 'completed';
  ELSIF v_has_overdue THEN
    v_new_status := 'overdue';
  ELSIF v_answered > 0 THEN
    v_new_status := 'partial_answered';
  ELSIF v_has_received THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.request_sessions
  SET
    cached_status = v_new_status,
    total_requests = v_total,
    answered_requests = v_answered,
    nearest_deadline = v_nearest,
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- 7. Trigger function: update session cache when request changes
CREATE OR REPLACE FUNCTION public.handle_request_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate current session
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.recalculate_session_status(NEW.session_id);
  END IF;

  -- If session_id changed, recalculate old session too
  IF TG_OP = 'UPDATE'
    AND OLD.session_id IS NOT NULL
    AND (NEW.session_id IS NULL OR OLD.session_id != NEW.session_id)
  THEN
    PERFORM public.recalculate_session_status(OLD.session_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_session_change
  AFTER INSERT OR UPDATE OF status, session_id, deadline_date, extension_date
  ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_request_session_update();

-- 8. Also handle request deletion (recalculate session)
CREATE OR REPLACE FUNCTION public.handle_request_session_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.session_id IS NOT NULL THEN
    PERFORM public.recalculate_session_status(OLD.session_id);
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_request_session_delete
  AFTER DELETE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_request_session_delete();

-- 9. Auto-wrap existing requests into sessions of 1
-- Create a session for each existing request that has no session_id
DO $$
DECLARE
  r RECORD;
  v_session_id UUID;
BEGIN
  FOR r IN
    SELECT * FROM public.requests WHERE session_id IS NULL
  LOOP
    INSERT INTO public.request_sessions (
      user_id, subject, institution_name, institution_email,
      cached_status, total_requests, answered_requests, nearest_deadline,
      created_at
    ) VALUES (
      r.user_id,
      r.subject,
      r.institution_name,
      r.institution_email,
      CASE r.status
        WHEN 'answered' THEN 'completed'
        WHEN 'delayed' THEN 'overdue'
        WHEN 'received' THEN 'in_progress'
        ELSE 'pending'
      END,
      1,
      CASE WHEN r.status = 'answered' THEN 1 ELSE 0 END,
      COALESCE(r.extension_date, r.deadline_date),
      r.created_at
    )
    RETURNING id INTO v_session_id;

    UPDATE public.requests
    SET session_id = v_session_id
    WHERE id = r.id;
  END LOOP;
END;
$$;
