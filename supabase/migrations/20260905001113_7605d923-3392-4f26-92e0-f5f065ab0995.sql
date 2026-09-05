CREATE OR REPLACE FUNCTION public.sync_trajet_prix_from_devis(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  n_trajets int;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id;
  IF d.id IS NULL OR d.prix_estime IS NULL OR d.prix_estime <= 0 THEN RETURN; END IF;

  -- Devis multi-véhicules : la répartition par trajet est gérée ailleurs.
  IF jsonb_typeof(d.vehicules) = 'array' AND jsonb_array_length(d.vehicules) > 1 THEN RETURN; END IF;

  SELECT count(*) INTO n_trajets FROM public.trajets t WHERE t.devis_id = d.id;
  IF n_trajets <> 1 THEN RETURN; END IF;

  UPDATE public.trajets t SET
    prix_client = d.prix_estime,
    prix = d.prix_estime,
    updated_at = now()
  WHERE t.devis_id = d.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.factures f
      JOIN public.attributions a ON a.id = f.mission_id
      WHERE a.trajet_id = t.id
    );

  UPDATE public.missions m SET
    prix_total = d.prix_estime,
    updated_at = now()
  WHERE m.devis_id = d.id
    AND COALESCE(m.prix_locked, false) = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.devis_prix_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.prix_estime IS DISTINCT FROM OLD.prix_estime THEN
    PERFORM public.sync_trajet_prix_from_devis(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_devis_prix_propagate ON public.devis;
CREATE TRIGGER trg_devis_prix_propagate
AFTER UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_prix_propagate();