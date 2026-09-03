ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'particulier',
  ADD COLUMN IF NOT EXISTS paiement_immediat boolean NOT NULL DEFAULT true;

ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_client_type_check;
ALTER TABLE public.devis ADD CONSTRAINT devis_client_type_check
  CHECK (client_type IN ('particulier','pro_ponctuel','pro_recurrent','flotte'));

CREATE OR REPLACE FUNCTION public.devis_set_paiement_immediat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_type IS NULL THEN
    NEW.client_type := 'particulier';
  END IF;
  NEW.paiement_immediat := NEW.client_type IN ('particulier','pro_ponctuel');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devis_set_paiement_immediat_trg ON public.devis;
CREATE TRIGGER devis_set_paiement_immediat_trg
  BEFORE INSERT ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.devis_set_paiement_immediat();