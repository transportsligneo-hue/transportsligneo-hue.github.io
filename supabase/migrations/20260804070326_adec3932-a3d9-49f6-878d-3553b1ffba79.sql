
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS numero_mission text;

-- 1) Aligner le compteur sur le plus haut numéro déjà utilisé (086)
UPDATE public.mission_sequences
SET current_value = GREATEST(current_value, 86), updated_at = now()
WHERE prefix = 'MIS-TLG' AND year = 2026;

-- 2) Reprendre les numéros déjà attribués (base sans suffixe A/R)
UPDATE public.trajets t
SET numero_mission = regexp_replace(a.numero_mission, '([0-9]{3})[AR]$', '\1')
FROM public.attributions a
WHERE a.trajet_id = t.id AND t.numero_mission IS NULL AND a.numero_mission IS NOT NULL;

-- 3) Propager le numéro de base à l'autre volet d'un aller-retour
UPDATE public.trajets t
SET numero_mission = g.num
FROM (
  SELECT mission_group_id, min(numero_mission) AS num
  FROM public.trajets
  WHERE mission_group_id IS NOT NULL AND numero_mission IS NOT NULL
  GROUP BY mission_group_id
) g
WHERE t.mission_group_id = g.mission_group_id AND t.numero_mission IS NULL;

-- 4) Numéroter séquentiellement les groupes restants (ordre chronologique)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT COALESCE(mission_group_id::text, id::text) AS grp, min(created_at) AS c
    FROM public.trajets
    WHERE numero_mission IS NULL
    GROUP BY 1
    ORDER BY 2
  LOOP
    UPDATE public.trajets
    SET numero_mission = public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM r.c)::int)
    WHERE COALESCE(mission_group_id::text, id::text) = r.grp AND numero_mission IS NULL;
  END LOOP;
END $$;

-- 5) Trigger : un numéro par mission, partagé entre les deux volets d'un A/R
CREATE OR REPLACE FUNCTION public.trajets_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_existing text;
BEGIN
  IF NEW.numero_mission IS NOT NULL AND NEW.numero_mission ~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    RETURN NEW;
  END IF;

  IF NEW.mission_group_id IS NOT NULL THEN
    SELECT numero_mission INTO v_existing
    FROM public.trajets
    WHERE mission_group_id = NEW.mission_group_id AND numero_mission IS NOT NULL
    LIMIT 1;
  END IF;

  NEW.numero_mission := COALESCE(
    v_existing,
    public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_trajets_set_numero ON public.trajets;
CREATE TRIGGER trg_trajets_set_numero
BEFORE INSERT ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.trajets_set_numero();

-- 6) L'attribution reprend le numéro du trajet au lieu d'en consommer un nouveau
CREATE OR REPLACE FUNCTION public.attributions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_num text;
BEGIN
  IF NEW.numero_mission IS NULL OR NEW.numero_mission !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    IF NEW.trajet_id IS NOT NULL THEN
      SELECT numero_mission INTO v_num FROM public.trajets WHERE id = NEW.trajet_id;
    END IF;
    NEW.numero_mission := COALESCE(
      v_num,
      public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int)
    );
  END IF;
  RETURN NEW;
END;
$function$;
