CREATE OR REPLACE FUNCTION public.attributions_seed_pv_digitaux()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_choice text;
  v_plaque text;
BEGIN
  SELECT COALESCE(t.pv_digitalise, dc.pv_digitalise, dv.pv_digitalise),
         UPPER(NULLIF(TRIM(COALESCE(t.immatriculation, t.vehicule_immatriculation)), ''))
    INTO v_choice, v_plaque
    FROM public.trajets t
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    LEFT JOIN public.devis dv ON dv.id = t.devis_id
   WHERE t.id = NEW.trajet_id;

  IF v_choice IS NULL OR v_choice = 'aucun' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mission_pv_digitaux (attribution_id, plateforme, actif, url, plaque, instruction)
  VALUES (
    NEW.id,
    v_choice,
    true,
    CASE WHEN v_choice = 'welcomeauto' THEN 'https://www.welcomeauto.fr' ELSE NULL END,
    v_plaque,
    CASE WHEN v_choice = 'welcomeauto'
      THEN 'Réaliser le PV de livraison sur Welcome Auto avec la plaque du véhicule.'
      ELSE 'Réaliser le PV de livraison depuis l''application moDel : plaque du véhicule + code fourni.'
    END
  )
  ON CONFLICT (attribution_id, plateforme) DO UPDATE
    SET plaque = COALESCE(public.mission_pv_digitaux.plaque, EXCLUDED.plaque);

  RETURN NEW;
END;
$$;

UPDATE public.mission_pv_digitaux p
   SET plaque = UPPER(NULLIF(TRIM(COALESCE(t.immatriculation, t.vehicule_immatriculation)), ''))
  FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
 WHERE a.id = p.attribution_id
   AND (p.plaque IS NULL OR TRIM(p.plaque) = '')
   AND COALESCE(t.immatriculation, t.vehicule_immatriculation) IS NOT NULL;