-- 1. Plateformes PV digitalisés : réintroduire Welcome Auto
ALTER TABLE public.mission_pv_digitaux DROP CONSTRAINT IF EXISTS mission_pv_digitaux_plateforme_check;
ALTER TABLE public.mission_pv_digitaux ADD CONSTRAINT mission_pv_digitaux_plateforme_check
  CHECK (plateforme IN ('model_arval','welcomeauto'));

-- 2. Choix du PV digitalisé lors de la demande de mission (espaces clients)
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS pv_digitalise text NOT NULL DEFAULT 'aucun';

ALTER TABLE public.demandes_convoyage DROP CONSTRAINT IF EXISTS demandes_convoyage_pv_digitalise_check;
ALTER TABLE public.demandes_convoyage ADD CONSTRAINT demandes_convoyage_pv_digitalise_check
  CHECK (pv_digitalise IN ('aucun','model_arval','welcomeauto'));

-- 3. Propagation automatique du choix client vers la mission attribuée
CREATE OR REPLACE FUNCTION public.attributions_seed_pv_digitaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text;
BEGIN
  SELECT dc.pv_digitalise INTO v_choice
  FROM public.trajets t
  JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
  WHERE t.id = NEW.trajet_id;

  IF v_choice IS NULL OR v_choice = 'aucun' THEN
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
      ELSE 'Réaliser le PV de livraison depuis l''application Model sur votre téléphone.'
    END
  )
  ON CONFLICT (attribution_id, plateforme) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attributions_seed_pv_digitaux_trg ON public.attributions;
CREATE TRIGGER attributions_seed_pv_digitaux_trg
AFTER INSERT ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.attributions_seed_pv_digitaux();