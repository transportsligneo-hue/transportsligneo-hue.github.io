ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS pv_digitalise text;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS pv_digitalise text;

-- Report automatique du choix PV (devis / demande) vers le trajet
CREATE OR REPLACE FUNCTION public.trajets_fill_pv_digitalise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pv_digitalise IS NULL OR NEW.pv_digitalise = '' THEN
    IF NEW.devis_id IS NOT NULL THEN
      SELECT d.pv_digitalise INTO NEW.pv_digitalise FROM public.devis d WHERE d.id = NEW.devis_id;
    END IF;
  END IF;
  IF (NEW.pv_digitalise IS NULL OR NEW.pv_digitalise = '') AND NEW.demande_id IS NOT NULL THEN
    SELECT dc.pv_digitalise INTO NEW.pv_digitalise FROM public.demandes_convoyage dc WHERE dc.id = NEW.demande_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trajets_fill_pv ON public.trajets;
CREATE TRIGGER trg_trajets_fill_pv
BEFORE INSERT OR UPDATE OF devis_id, demande_id ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.trajets_fill_pv_digitalise();

-- Seed du PV digitalisé dans la mission attribuée au convoyeur
CREATE OR REPLACE FUNCTION public.attributions_seed_pv_digitaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text;
BEGIN
  SELECT COALESCE(t.pv_digitalise, dc.pv_digitalise, dv.pv_digitalise)
    INTO v_choice
    FROM public.trajets t
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    LEFT JOIN public.devis dv ON dv.id = t.devis_id
   WHERE t.id = NEW.trajet_id;

  IF v_choice IS NULL OR v_choice = 'aucun' OR v_choice = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mission_pv_digitaux (attribution_id, plateforme, actif, url, instruction)
  VALUES (
    NEW.id,
    v_choice,
    true,
    CASE WHEN v_choice = 'welcomeauto' THEN 'https://www.welcomeauto.fr' ELSE NULL END,
    CASE WHEN v_choice = 'welcomeauto'
      THEN 'Réaliser le PV de livraison sur Welcome Auto.'
      ELSE 'Réaliser le PV de livraison depuis l''application moDel sur votre téléphone.'
    END
  )
  ON CONFLICT (attribution_id, plateforme) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Rattrapage : trajets existants issus d'une demande avec choix PV
UPDATE public.trajets t
   SET pv_digitalise = dc.pv_digitalise
  FROM public.demandes_convoyage dc
 WHERE dc.id = t.demande_id
   AND t.pv_digitalise IS NULL
   AND dc.pv_digitalise IS NOT NULL;