CREATE OR REPLACE FUNCTION public.fill_trajet_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date_souhaitee date;
  v_heure_souhaitee text;
  v_date_retour date;
  v_heure_retour text;
  v_mission_date date;
  v_mission_prix numeric;
BEGIN
  IF NEW.demande_id IS NOT NULL THEN
    SELECT d.date_souhaitee, d.heure_souhaitee, d.date_retour, d.heure_retour
      INTO v_date_souhaitee, v_heure_souhaitee, v_date_retour, v_heure_retour
      FROM public.demandes_convoyage d WHERE d.id = NEW.demande_id;
  END IF;

  IF NEW.mission_id IS NOT NULL THEN
    SELECT m.date_prise_en_charge, m.prix_total
      INTO v_mission_date, v_mission_prix
      FROM public.missions m WHERE m.id = NEW.mission_id;
  END IF;

  IF NEW.date_trajet IS NULL THEN
    IF NEW.leg_type = 'retour' THEN
      NEW.date_trajet := COALESCE(v_date_retour, NEW.date_souhaitee, v_date_souhaitee, v_mission_date);
    ELSE
      NEW.date_trajet := COALESCE(NEW.date_souhaitee, v_date_souhaitee, v_mission_date);
    END IF;
  END IF;

  IF NEW.heure_trajet IS NULL OR NEW.heure_trajet = '' THEN
    IF NEW.leg_type = 'retour' THEN
      NEW.heure_trajet := NULLIF(COALESCE(v_heure_retour, v_heure_souhaitee, ''), '');
    ELSE
      NEW.heure_trajet := NULLIF(COALESCE(v_heure_souhaitee, ''), '');
    END IF;
  END IF;

  IF NEW.prix_client IS NULL THEN
    NEW.prix_client := COALESCE(NEW.prix_total, v_mission_prix);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_fill_trajet_defaults ON public.trajets;
CREATE TRIGGER trg_a_fill_trajet_defaults
BEFORE INSERT OR UPDATE ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.fill_trajet_defaults();

UPDATE public.trajets
SET updated_at = now()
WHERE date_trajet IS NULL
   OR heure_trajet IS NULL
   OR heure_trajet = ''
   OR (COALESCE(prix_convoyeur_fixe, prix_convoyeur, prix_suggere, 0) = 0
       AND COALESCE(prix_total, 0) > 0);