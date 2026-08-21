CREATE OR REPLACE FUNCTION public.attributions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_num text;
  v_leg text;
  v_leg_index int;
  v_round boolean;
  v_candidate text;
  v_base text;
  v_suffix text;
  i int := 0;
BEGIN
  IF NEW.numero_mission IS NULL OR NEW.numero_mission !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}([AR]|\.[0-9]+)?$' THEN
    IF NEW.trajet_id IS NOT NULL THEN
      SELECT t.numero_mission, t.leg_type, t.leg_index, COALESCE(t.is_round_trip, false)
        INTO v_num, v_leg, v_leg_index, v_round
      FROM public.trajets t WHERE t.id = NEW.trajet_id;
    END IF;

    v_candidate := COALESCE(
      v_num,
      public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int)
    );

    IF COALESCE(v_round, false) OR v_leg IN ('aller','retour') OR v_leg_index = 2 THEN
      v_suffix := CASE WHEN v_leg = 'retour' OR v_leg_index = 2 THEN 'R' ELSE 'A' END;
      IF v_candidate !~ '[AR]$' THEN
        v_candidate := v_candidate || v_suffix;
      END IF;
    END IF;

    NEW.numero_mission := v_candidate;
  END IF;

  -- En cas de collision : ne JAMAIS consommer un nouveau numéro de mission
  -- (cela créait de faux doublons type #118 pour la 2e plaque du dossier #108).
  -- On ajoute un sous-index .2, .3, ... sur le même numéro de base.
  v_base := regexp_replace(NEW.numero_mission, '\.[0-9]+$', '');
  i := 1;
  WHILE EXISTS (
    SELECT 1 FROM public.attributions a
    WHERE a.numero_mission = NEW.numero_mission
      AND a.id IS DISTINCT FROM NEW.id
  ) AND i < 50 LOOP
    i := i + 1;
    NEW.numero_mission := v_base || '.' || i::text;
  END LOOP;

  RETURN NEW;
END;
$function$;

UPDATE public.attributions
SET numero_mission = 'MIS-TLG-2026-108.2'
WHERE numero_mission IN ('MIS-TLG-2026-#118', 'MIS-TLG-2026-118');