CREATE OR REPLACE FUNCTION public.sync_attribution_numero_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text := public.mission_numero_base(NEW.numero_mission);
  v_suffix text;
BEGIN
  IF v_base IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.numero_mission IS NOT DISTINCT FROM OLD.numero_mission THEN
    RETURN NEW;
  END IF;

  v_suffix := public.mission_leg_suffix(NEW.id);

  UPDATE public.attributions SET numero_mission = NULL WHERE trajet_id = NEW.id;

  UPDATE public.attributions a
     SET numero_mission = v_base || v_suffix
                          || CASE WHEN r.rn > 1 THEN '.' || r.rn ELSE '' END,
         updated_at = now()
    FROM (
      SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
        FROM public.attributions WHERE trajet_id = NEW.id
    ) r
   WHERE a.id = r.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_attribution_numero_from_trajet() FROM anon, authenticated, public;