CREATE OR REPLACE FUNCTION public.factures_prevent_group_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trajet_id uuid;
  v_group_id uuid;
  v_existing text;
BEGIN
  IF NEW.attribution_id IS NULL AND NEW.mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(a.trajet_id, NEW.mission_id) INTO v_trajet_id
  FROM public.attributions a
  WHERE a.id = NEW.attribution_id;

  IF v_trajet_id IS NULL THEN
    v_trajet_id := NEW.mission_id;
  END IF;

  IF v_trajet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.mission_group_id INTO v_group_id FROM public.trajets t WHERE t.id = v_trajet_id;

  IF v_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.numero INTO v_existing
  FROM public.factures f
  LEFT JOIN public.attributions a2 ON a2.id = f.attribution_id
  LEFT JOIN public.trajets t2 ON t2.id = COALESCE(a2.trajet_id, f.mission_id)
  WHERE f.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND t2.mission_group_id = v_group_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Une facture (%) existe déjà pour ce duo Livraison-Restitution : une seule facture globale est autorisée.', v_existing;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factures_prevent_group_duplicate ON public.factures;
CREATE TRIGGER trg_factures_prevent_group_duplicate
BEFORE INSERT ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.factures_prevent_group_duplicate();