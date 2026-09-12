-- 1) Backfill from trajets
UPDATE public.missions m
SET heure_prise_en_charge = t.heure_trajet::text,
    updated_at = now()
FROM public.trajets t
WHERE m.heure_prise_en_charge IS NULL
  AND t.heure_trajet IS NOT NULL
  AND (t.mission_id = m.id
       OR (t.numero_mission = m.numero
           AND coalesce(t.leg_type,'simple') = coalesce(m.leg_type,'simple')));

-- 2) Backfill from devis (aller/simple -> heure_souhaitee, retour -> heure_retour)
UPDATE public.missions m
SET heure_prise_en_charge = CASE
      WHEN coalesce(m.leg_type,'simple') = 'retour'
        THEN coalesce(nullif(d.heure_retour::text,''), nullif(d.heure_souhaitee::text,''))
      ELSE nullif(d.heure_souhaitee::text,'')
    END,
    updated_at = now()
FROM public.devis d
WHERE m.devis_id = d.id
  AND m.heure_prise_en_charge IS NULL
  AND CASE
        WHEN coalesce(m.leg_type,'simple') = 'retour'
          THEN coalesce(nullif(d.heure_retour::text,''), nullif(d.heure_souhaitee::text,''))
        ELSE nullif(d.heure_souhaitee::text,'')
      END IS NOT NULL;

-- 3) Backfill from any trajet sharing the same mission numero (fallback)
UPDATE public.missions m
SET heure_prise_en_charge = t.heure_trajet::text,
    updated_at = now()
FROM public.trajets t
WHERE m.heure_prise_en_charge IS NULL
  AND t.heure_trajet IS NOT NULL
  AND t.numero_mission = m.numero;

-- 4) Auto-fill on insert/update so new missions always carry an hour when known
CREATE OR REPLACE FUNCTION public.missions_fill_heure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _h text;
BEGIN
  IF nullif(NEW.heure_prise_en_charge,'') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT nullif(t.heure_trajet::text,'') INTO _h
  FROM public.trajets t
  WHERE (t.mission_id = NEW.id)
     OR (NEW.numero IS NOT NULL AND t.numero_mission = NEW.numero
         AND coalesce(t.leg_type,'simple') = coalesce(NEW.leg_type,'simple'))
  ORDER BY (t.mission_id = NEW.id) DESC
  LIMIT 1;

  IF _h IS NULL AND NEW.devis_id IS NOT NULL THEN
    SELECT CASE
             WHEN coalesce(NEW.leg_type,'simple') = 'retour'
               THEN coalesce(nullif(d.heure_retour::text,''), nullif(d.heure_souhaitee::text,''))
             ELSE nullif(d.heure_souhaitee::text,'')
           END
      INTO _h
    FROM public.devis d
    WHERE d.id = NEW.devis_id;
  END IF;

  IF _h IS NOT NULL THEN
    NEW.heure_prise_en_charge := _h;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.missions_fill_heure() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_missions_fill_heure ON public.missions;
CREATE TRIGGER trg_missions_fill_heure
BEFORE INSERT OR UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_fill_heure();
