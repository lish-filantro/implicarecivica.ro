-- 019: genul solicitantului, pentru acordul gramatical din cererile 544.
--
-- Textul cererii scrie „Subsemnatul" / „Subsemnata"; fără câmpul ăsta, formularea era greşită
-- pentru jumătate dintre utilizatori (raportul de testare din 2026-09-22).
-- Rămâne NULL pentru conturile existente; şablonul foloseşte „Subsemnatul/Subsemnata" atunci.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('f', 'm'));

COMMENT ON COLUMN public.profiles.gender IS
  'f | m | NULL — folosit doar pentru acordul gramatical din cererile 544.';

-- Propagă genul din metadatele de înregistrare, ca numele în 005.
-- Numele contează: Postgres execută trigger-ele AFTER în ordine alfabetică, iar
-- `on_auth_user_created` (003/005, cel care inserează rândul din `profiles`) vine înaintea lui
-- `on_auth_user_gender`. Altfel UPDATE-ul de mai jos nu ar găsi niciun rând.
CREATE OR REPLACE FUNCTION public.sync_profile_gender()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'gender' IN ('f', 'm') THEN
    UPDATE public.profiles
       SET gender = NEW.raw_user_meta_data->>'gender'
     WHERE id = NEW.id AND gender IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_gender ON auth.users;
CREATE TRIGGER on_auth_user_gender
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_gender();
