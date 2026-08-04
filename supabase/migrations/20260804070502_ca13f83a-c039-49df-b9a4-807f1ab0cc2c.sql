
UPDATE public.trajets t
SET numero_mission = g.num
FROM (
  SELECT mission_group_id, min(numero_mission) AS num
  FROM public.trajets
  WHERE mission_group_id IS NOT NULL AND numero_mission IS NOT NULL
  GROUP BY mission_group_id
) g
WHERE t.mission_group_id = g.mission_group_id AND t.numero_mission IS DISTINCT FROM g.num;

CREATE OR REPLACE FUNCTION public.trajets_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_existing text; v_num text;
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

  IF v_existing IS NULL THEN
    v_num := public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int);
  ELSE
    v_num := v_existing;
  END IF;

  NEW.numero_mission := v_num;
  RETURN NEW;
END;
$function$;
