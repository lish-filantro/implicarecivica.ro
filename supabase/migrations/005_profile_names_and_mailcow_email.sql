-- ============================================
-- Migration 005: Profile Names + Platform Email
-- implicarecivica.ro
-- ============================================

-- 1. Add new columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mailcow_email TEXT;

-- Unique constraint on platform email
ALTER TABLE public.profiles ADD CONSTRAINT profiles_mailcow_email_unique UNIQUE (mailcow_email);

-- 2. Helper: normalize Romanian diacritics and special chars
CREATE OR REPLACE FUNCTION public.normalize_name(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    translate(
      trim(input),
      'ăâîșțĂÂÎȘȚáàäéèëíìïóòöúùü ÁÀÄÉÈËÍÌÏÓÒÖÚÙÜ',
      'aaisstaaisstaaaeeeiiiooouu-aaaeeeiiiooouu'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Replace handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_fname TEXT;
  raw_lname TEXT;
  fname TEXT;
  lname TEXT;
  full_display TEXT;
  separators TEXT[] := ARRAY['.', '-', '_'];
  candidate TEXT;
  domain TEXT := 'implicarecivica.ro';
  sep TEXT;
  counter INT;
BEGIN
  -- Extract names from signup metadata
  raw_fname := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  raw_lname := COALESCE(NEW.raw_user_meta_data->>'last_name', '');

  -- Normalize: remove diacritics, lowercase, replace spaces with hyphens
  fname := public.normalize_name(raw_fname);
  lname := public.normalize_name(raw_lname);

  -- Build display name from original (non-normalized) names
  full_display := COALESCE(
    NULLIF(trim(raw_fname || ' ' || raw_lname), ''),
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- If names are provided, generate platform email
  IF fname <> '' AND lname <> '' THEN
    -- Try each separator: . then - then _
    FOREACH sep IN ARRAY separators LOOP
      candidate := fname || sep || lname || '@' || domain;
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE mailcow_email = candidate) THEN
        INSERT INTO public.profiles (id, first_name, last_name, display_name, mailcow_email)
        VALUES (NEW.id, raw_fname, raw_lname, full_display, candidate);
        RETURN NEW;
      END IF;
    END LOOP;

    -- All separators taken, add incrementing number
    counter := 1;
    LOOP
      candidate := fname || '.' || lname || counter::TEXT || '@' || domain;
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE mailcow_email = candidate) THEN
        INSERT INTO public.profiles (id, first_name, last_name, display_name, mailcow_email)
        VALUES (NEW.id, raw_fname, raw_lname, full_display, candidate);
        RETURN NEW;
      END IF;
      counter := counter + 1;
      EXIT WHEN counter > 100; -- Safety limit
    END LOOP;
  END IF;

  -- Fallback: no names provided (e.g. OAuth), create profile without mailcow_email
  INSERT INTO public.profiles (id, first_name, last_name, display_name)
  VALUES (NEW.id, NULLIF(raw_fname, ''), NULLIF(raw_lname, ''), full_display);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Backfill existing users: set first_name/last_name from metadata where available
UPDATE public.profiles p
SET
  first_name = COALESCE(u.raw_user_meta_data->>'first_name', p.first_name),
  last_name = COALESCE(u.raw_user_meta_data->>'last_name', p.last_name)
FROM auth.users u
WHERE p.id = u.id
  AND p.first_name IS NULL;
