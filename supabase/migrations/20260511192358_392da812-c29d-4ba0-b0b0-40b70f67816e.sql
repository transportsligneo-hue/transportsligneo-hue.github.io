-- Add user_id, payment status & stripe session to demandes_convoyage
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS distance_km integer,
  ADD COLUMN IF NOT EXISTS prix_estime numeric;

CREATE INDEX IF NOT EXISTS idx_demandes_user_id ON public.demandes_convoyage(user_id);
CREATE INDEX IF NOT EXISTS idx_demandes_payment_status ON public.demandes_convoyage(payment_status);

-- Trigger to auto-set user_id on insert
CREATE OR REPLACE FUNCTION public.demandes_set_user_id()
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

DROP TRIGGER IF EXISTS demandes_set_user_id_trg ON public.demandes_convoyage;
CREATE TRIGGER demandes_set_user_id_trg
  BEFORE INSERT ON public.demandes_convoyage
  FOR EACH ROW
  EXECUTE FUNCTION public.demandes_set_user_id();

-- RLS for clients to read & create their own demandes via user_id
DROP POLICY IF EXISTS "Clients read demandes by user_id" ON public.demandes_convoyage;
CREATE POLICY "Clients read demandes by user_id"
  ON public.demandes_convoyage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users update own pending demandes" ON public.demandes_convoyage;
CREATE POLICY "Authenticated users update own pending demandes"
  ON public.demandes_convoyage
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND payment_status = 'pending')
  WITH CHECK (user_id = auth.uid());