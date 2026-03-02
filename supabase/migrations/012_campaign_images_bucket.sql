-- Campaign images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (public bucket)
CREATE POLICY "Public read campaign images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-images');

-- Authenticated users can upload
CREATE POLICY "Auth users upload campaign images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-images'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can update their uploads
CREATE POLICY "Auth users update campaign images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'campaign-images'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can delete
CREATE POLICY "Auth users delete campaign images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'campaign-images'
    AND auth.role() = 'authenticated'
  );
