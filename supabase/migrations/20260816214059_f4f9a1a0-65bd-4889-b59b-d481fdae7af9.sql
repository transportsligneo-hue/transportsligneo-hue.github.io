CREATE OR REPLACE FUNCTION public.sync_trajet_dates_from_devis(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d record;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id;
  IF d.id IS NULL THEN RETURN; END IF;

  UPDATE public.trajets t SET
    date_trajet = COALESCE(
      t.date_trajet,
      CASE WHEN COALESCE(t.leg_index, 1) = 2 THEN COALESCE(d.date_retour, d.date_souhaitee) ELSE d.date_souhaitee END
    ),
    heure_trajet = COALESCE(
      NULLIF(t.heure_trajet, ''),
      CASE WHEN COALESCE(t.leg_index, 1) = 2 THEN COALESCE(d.heure_retour, d.heure_souhaitee) ELSE d.heure_souhaitee END
    ),
    date_souhaitee = COALESCE(t.date_souhaitee, d.date_souhaitee),
    updated_at = now()
  WHERE t.devis_id = d.id
     OR (d.mission_group_id IS NOT NULL AND t.mission_group_id = d.mission_group_id);

  UPDATE public.missions m SET
    date_prise_en_charge = COALESCE(
      m.date_prise_en_charge,
      CASE WHEN COALESCE(m.leg_index, 1) = 2 THEN COALESCE(d.date_retour, d.date_souhaitee) ELSE d.date_souhaitee END
    ),
    updated_at = now()
  WHERE (m.devis_id = d.id OR (d.mission_group_id IS NOT NULL AND m.mission_group_id = d.mission_group_id))
    AND m.date_prise_en_charge IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_trajet_dates_from_devis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_trajet_dates_from_devis(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.devis_dates_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_souhaitee IS DISTINCT FROM OLD.date_souhaitee
     OR NEW.heure_souhaitee IS DISTINCT FROM OLD.heure_souhaitee
     OR NEW.date_retour IS DISTINCT FROM OLD.date_retour
     OR NEW.heure_retour IS DISTINCT FROM OLD.heure_retour THEN
    PERFORM public.sync_trajet_dates_from_devis(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_dates_propagate ON public.devis;
CREATE TRIGGER trg_devis_dates_propagate
AFTER UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_dates_propagate();