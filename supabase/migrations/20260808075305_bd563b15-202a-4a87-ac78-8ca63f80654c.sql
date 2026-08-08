CREATE OR REPLACE FUNCTION public.attributions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_num text;
  v_leg text;
  v_leg_index int;
  v_candidate text;
  v_suffix text;
  i int := 0;
BEGIN
  IF NEW.numero_mission IS NULL OR NEW.numero_mission !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}[AR]?$' THEN
    IF NEW.trajet_id IS NOT NULL THEN
      SELECT t.numero_mission, t.leg_type, t.leg_index
        INTO v_num, v_leg, v_leg_index
      FROM public.trajets t WHERE t.id = NEW.trajet_id;
    END IF;

    v_candidate := COALESCE(
      v_num,
      public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int)
    );

    -- Suffixe A/R pour les missions livraison + restitution
    IF v_leg IS NOT NULL OR v_leg_index IS NOT NULL THEN
      v_suffix := CASE WHEN v_leg = 'retour' OR v_leg_index = 2 THEN 'R' ELSE 'A' END;
      IF v_candidate !~ '[AR]$' THEN
        v_candidate := v_candidate || v_suffix;
      END IF;
    END IF;

    NEW.numero_mission := v_candidate;
  END IF;

  -- Garantit l'unicité : si le numéro est déjà pris, on en génère un nouveau
  WHILE EXISTS (
    SELECT 1 FROM public.attributions a
    WHERE a.numero_mission = NEW.numero_mission
      AND a.id IS DISTINCT FROM NEW.id
  ) AND i < 25 LOOP
    i := i + 1;
    NEW.numero_mission := public.next_document_number(
      'MIS-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    ) || COALESCE(v_suffix, '');
  END LOOP;

  RETURN NEW;
END;
$function$;