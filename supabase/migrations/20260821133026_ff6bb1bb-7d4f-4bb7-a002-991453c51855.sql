DO $$
DECLARE
  v_attr uuid;
BEGIN
  SELECT a.id INTO v_attr
  FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
  WHERE t.numero_mission = 'MIS-TLG-2026-#107'
  LIMIT 1;

  IF v_attr IS NULL THEN
    RAISE NOTICE 'Mission #107 introuvable';
    RETURN;
  END IF;

  DELETE FROM public.inspection_photos
  WHERE inspection_id IN (SELECT id FROM public.inspections WHERE attribution_id = v_attr);

  DELETE FROM public.inspections WHERE attribution_id = v_attr;
  DELETE FROM public.mission_etape_history WHERE attribution_id = v_attr;

  UPDATE public.attributions
  SET etape_courante = NULL,
      options_completion = '{}'::jsonb,
      statut = 'accepte'
  WHERE id = v_attr;
END $$;