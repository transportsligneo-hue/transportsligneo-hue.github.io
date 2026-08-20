ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS delai_paiement_defaut text NOT NULL DEFAULT 'j30';

ALTER TABLE public.remunerations_missions
  ADD COLUMN IF NOT EXISTS delai_paiement text NOT NULL DEFAULT 'j30',
  ADD COLUMN IF NOT EXISTS echeance_paiement date,
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paye_manuellement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paye_at timestamptz,
  ADD COLUMN IF NOT EXISTS paiement_reference text,
  ADD COLUMN IF NOT EXISTS paiement_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remunerations_delai_paiement_check') THEN
    ALTER TABLE public.remunerations_missions
      ADD CONSTRAINT remunerations_delai_paiement_check CHECK (delai_paiement IN ('j15','j30','manuel'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convoyeurs_delai_paiement_defaut_check') THEN
    ALTER TABLE public.convoyeurs
      ADD CONSTRAINT convoyeurs_delai_paiement_defaut_check CHECK (delai_paiement_defaut IN ('j15','j30','manuel'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remunerations_set_echeance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_date date;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.convoyeur_id IS NOT NULL THEN
    SELECT COALESCE(c.delai_paiement_defaut, 'j30') INTO NEW.delai_paiement
    FROM public.convoyeurs c WHERE c.id = NEW.convoyeur_id;
    IF NEW.delai_paiement IS NULL THEN NEW.delai_paiement := 'j30'; END IF;
  END IF;

  base_date := COALESCE(NEW.date_mission::date, NEW.calcule_at::date, CURRENT_DATE);

  IF NEW.delai_paiement = 'j15' THEN
    NEW.echeance_paiement := base_date + 15;
  ELSIF NEW.delai_paiement = 'j30' THEN
    NEW.echeance_paiement := base_date + 30;
  ELSIF NEW.echeance_paiement IS NULL THEN
    NEW.echeance_paiement := base_date + 30;
  END IF;

  IF NEW.paye_manuellement AND NEW.paye_at IS NULL THEN
    NEW.paye_at := now();
  END IF;
  IF NOT NEW.paye_manuellement AND TG_OP = 'UPDATE' AND OLD.paye_manuellement THEN
    NEW.paye_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remunerations_set_echeance ON public.remunerations_missions;
CREATE TRIGGER trg_remunerations_set_echeance
  BEFORE INSERT OR UPDATE ON public.remunerations_missions
  FOR EACH ROW EXECUTE FUNCTION public.remunerations_set_echeance();

UPDATE public.remunerations_missions
SET echeance_paiement = COALESCE(date_mission::date, calcule_at::date) + 30
WHERE echeance_paiement IS NULL;