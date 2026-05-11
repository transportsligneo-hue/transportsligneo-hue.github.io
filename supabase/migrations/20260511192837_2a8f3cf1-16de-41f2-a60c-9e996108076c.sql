ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer;

CREATE INDEX IF NOT EXISTS idx_devis_user_id ON public.devis(user_id);

-- Backfill user_id where possible from profiles by email
UPDATE public.devis d
  SET user_id = p.user_id
  FROM public.profiles p
  WHERE d.user_id IS NULL
    AND p.email IS NOT NULL
    AND lower(p.email) = lower(d.email);

-- Trigger to auto-set user_id on insert
CREATE OR REPLACE FUNCTION public.devis_set_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devis_set_user_id_trg ON public.devis;
CREATE TRIGGER devis_set_user_id_trg
  BEFORE INSERT ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION public.devis_set_user_id();

DROP POLICY IF EXISTS "Clients read own devis by user_id" ON public.devis;
CREATE POLICY "Clients read own devis by user_id"
  ON public.devis
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());