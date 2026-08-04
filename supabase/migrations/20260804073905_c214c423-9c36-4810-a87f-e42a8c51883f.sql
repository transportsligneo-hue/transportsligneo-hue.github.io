-- Aligner les numéros opérationnels sur la séquence du devis source.
-- Le dièse reste une convention d'affichage côté application.

CREATE OR REPLACE FUNCTION public.missions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_devis_numero text;
BEGIN
  IF NEW.devis_id IS NOT NULL THEN
    SELECT d.numero INTO v_devis_numero
    FROM public.devis d
    WHERE d.id = NEW.devis_id;
  END IF;

  IF v_devis_numero ~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := regexp_replace(v_devis_numero, '^DEV-', 'MIS-');
  ELSIF NEW.numero IS NULL OR NEW.numero !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trajets_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_devis_numero text;
  v_existing text;
BEGIN
  IF NEW.devis_id IS NOT NULL THEN
    SELECT d.numero INTO v_devis_numero
    FROM public.devis d
    WHERE d.id = NEW.devis_id;
  END IF;

  IF v_devis_numero ~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero_mission := regexp_replace(v_devis_numero, '^DEV-', 'MIS-');
    RETURN NEW;
  END IF;

  IF NEW.numero_mission IS NOT NULL AND NEW.numero_mission ~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    RETURN NEW;
  END IF;

  IF NEW.mission_group_id IS NOT NULL THEN
    SELECT t.numero_mission INTO v_existing
    FROM public.trajets t
    WHERE t.mission_group_id = NEW.mission_group_id
      AND t.numero_mission IS NOT NULL
    ORDER BY t.leg_index NULLS LAST, t.created_at
    LIMIT 1;
  END IF;

  NEW.numero_mission := COALESCE(
    v_existing,
    public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    )
  );
  RETURN NEW;
END;
$function$;

-- Réparer les enregistrements déjà convertis en prenant exactement la séquence du devis.
UPDATE public.missions m
SET numero = regexp_replace(d.numero, '^DEV-', 'MIS-'),
    updated_at = now()
FROM public.devis d
WHERE m.devis_id = d.id
  AND d.numero ~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$'
  AND m.numero IS DISTINCT FROM regexp_replace(d.numero, '^DEV-', 'MIS-');

UPDATE public.trajets t
SET numero_mission = regexp_replace(d.numero, '^DEV-', 'MIS-')
FROM public.devis d
WHERE t.devis_id = d.id
  AND d.numero ~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$'
  AND t.numero_mission IS DISTINCT FROM regexp_replace(d.numero, '^DEV-', 'MIS-');

REVOKE ALL ON FUNCTION public.missions_set_numero() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trajets_set_numero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.missions_set_numero() TO service_role;
GRANT EXECUTE ON FUNCTION public.trajets_set_numero() TO service_role;