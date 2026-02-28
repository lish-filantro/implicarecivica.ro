-- ============================================
-- Migration 001: Initial Schema
-- implicarecivica.ro - Law 544/2001 Platform
-- ============================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for RAG
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation

-- 2. Requests table (Law 544/2001 public information requests)
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Institution details
  institution_id TEXT,
  institution_name TEXT NOT NULL,
  institution_email TEXT,

  -- Request content
  subject TEXT NOT NULL,
  request_body TEXT,
  body TEXT,
  summary TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'extension', 'answered', 'delayed')),
  registration_number TEXT,

  -- Dates
  date_initiated TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_sent TIMESTAMPTZ,
  date_received TIMESTAMPTZ,
  deadline_date TIMESTAMPTZ,
  extension_date TIMESTAMPTZ,
  response_received_date TIMESTAMPTZ,

  -- Extension details
  extension_days INTEGER,
  extension_reason TEXT,

  -- Answer (when status='answered')
  answer_summary JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX idx_requests_user_id ON public.requests(user_id);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_date_initiated ON public.requests(date_initiated DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_requests_updated
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Documents table (RAG vector store)
CREATE TABLE public.documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536)  -- OpenAI text-embedding-ada-002 dimension
);

-- HNSW index for fast similarity search
CREATE INDEX idx_documents_embedding ON public.documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. RPC function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE SQL STABLE AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Row Level Security (RLS)
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Requests: users can only see/modify their own requests
CREATE POLICY "Users can view their own requests"
  ON public.requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests"
  ON public.requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own requests"
  ON public.requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own requests"
  ON public.requests FOR DELETE
  USING (auth.uid() = user_id);

-- Documents: readable by all authenticated users (RAG knowledge base)
CREATE POLICY "Authenticated users can read documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

-- Documents: only service role can insert/update/delete (admin only)
CREATE POLICY "Service role can manage documents"
  ON public.documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
