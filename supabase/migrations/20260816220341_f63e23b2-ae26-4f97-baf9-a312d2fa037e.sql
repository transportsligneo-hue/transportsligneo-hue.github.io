-- Forward: devis -> trajets/missions (dates + plates)
CREATE OR REPLACE FUNCTION public.sync_trajet_dates_from_devis(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    immatriculation = COALESCE(
      NULLIF(t.immatriculation, ''),
      CASE WHEN COALESCE(t.leg_index, 1) = 2 THEN COALESCE(d.immatriculation_retour, d.immatriculation) ELSE d.immatriculation END
    ),
    vehicule_immatriculation = COALESCE(
      NULLIF(t.vehicule_immatriculation, ''),
      NULLIF(t.immatriculation, ''),
      CASE WHEN COALESCE(t.leg_index, 1) = 2 THEN COALESCE(d.immatriculation_retour, d.immatriculation) ELSE d.immatriculation END
    ),
    updated_at = now()
  WHERE t.devis_id = d.id
     OR (d.mission_group_id IS NOT NULL AND t.mission_group_id = d.mission_group_id);

  UPDATE public.missions m SET
    date_prise_en_charge = COALESCE(
      m.date_prise_en_charge,
      CASE WHEN COALESCE(m.leg_index, 1) = 2 THEN COALESCE(d.date_retour, d.date_souhaitee) ELSE d.date_souhaitee END
    ),
    immatriculation = COALESCE(
      NULLIF(m.immatriculation, ''),
      CASE WHEN COALESCE(m.leg_index, 1) = 2 THEN COALESCE(d.immatriculation_retour, d.immatriculation) ELSE d.immatriculation END
    ),
    updated_at = now()
  WHERE (m.devis_id = d.id OR (d.mission_group_id IS NOT NULL AND m.mission_group_id = d.mission_group_id));
END;
$function$;

-- Fire the forward sync on plate changes too
CREATE OR REPLACE FUNCTION public.devis_dates_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.date_souhaitee IS DISTINCT FROM OLD.date_souhaitee
     OR NEW.heure_souhaitee IS DISTINCT FROM OLD.heure_souhaitee
     OR NEW.date_retour IS DISTINCT FROM OLD.date_retour
     OR NEW.heure_retour IS DISTINCT FROM OLD.heure_retour
     OR NEW.immatriculation IS DISTINCT FROM OLD.immatriculation
     OR NEW.immatriculation_retour IS DISTINCT FROM OLD.immatriculation_retour THEN
    PERFORM public.sync_trajet_dates_from_devis(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Reverse: trajet -> devis (fill blanks only, never overwrite the quote)
CREATE OR REPLACE FUNCTION public.sync_devis_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _leg int;
BEGIN
  IF NEW.devis_id IS NULL THEN RETURN NEW; END IF;
  _leg := COALESCE(NEW.leg_index, 1);

  IF _leg = 2 THEN
    UPDATE public.devis d SET
      date_retour = COALESCE(d.date_retour, NEW.date_trajet),
      heure_retour = COALESCE(NULLIF(d.heure_retour, ''), NULLIF(NEW.heure_trajet, '')),
      immatriculation_retour = COALESCE(NULLIF(d.immatriculation_retour, ''), NULLIF(NEW.immatriculation, '')),
      updated_at = now()
    WHERE d.id = NEW.devis_id;
  ELSE
    UPDATE public.devis d SET
      date_souhaitee = COALESCE(d.date_souhaitee, NEW.date_trajet),
      heure_souhaitee = COALESCE(NULLIF(d.heure_souhaitee, ''), NULLIF(NEW.heure_trajet, '')),
      immatriculation = COALESCE(NULLIF(d.immatriculation, ''), NULLIF(NEW.immatriculation, '')),
      updated_at = now()
    WHERE d.id = NEW.devis_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_trajets_sync_devis ON public.trajets;
CREATE TRIGGER trg_trajets_sync_devis
AFTER INSERT OR UPDATE OF date_trajet, heure_trajet, immatriculation ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.sync_devis_from_trajet();

-- Backfill: reverse first (quotes learn from missions), then forward (missions learn from quotes)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, devis_id, leg_index, date_trajet, heure_trajet, immatriculation
           FROM public.trajets WHERE devis_id IS NOT NULL LOOP
    IF COALESCE(r.leg_index, 1) = 2 THEN
      UPDATE public.devis d SET
        date_retour = COALESCE(d.date_retour, r.date_trajet),
        heure_retour = COALESCE(NULLIF(d.heure_retour, ''), NULLIF(r.heure_trajet, '')),
        immatriculation_retour = COALESCE(NULLIF(d.immatriculation_retour, ''), NULLIF(r.immatriculation, ''))
      WHERE d.id = r.devis_id;
    ELSE
      UPDATE public.devis d SET
        date_souhaitee = COALESCE(d.date_souhaitee, r.date_trajet),
        heure_souhaitee = COALESCE(NULLIF(d.heure_souhaitee, ''), NULLIF(r.heure_trajet, '')),
        immatriculation = COALESCE(NULLIF(d.immatriculation, ''), NULLIF(r.immatriculation, ''))
      WHERE d.id = r.devis_id;
    END IF;
  END LOOP;

  FOR r IN SELECT DISTINCT id FROM public.devis LOOP
    PERFORM public.sync_trajet_dates_from_devis(r.id);
  END LOOP;
END $$;