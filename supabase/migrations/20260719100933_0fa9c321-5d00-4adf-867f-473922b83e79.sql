
CREATE OR REPLACE FUNCTION public.admin_reset_mission(_attribution_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trajet_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT trajet_id INTO v_trajet_id FROM public.attributions WHERE id = _attribution_id;
  IF v_trajet_id IS NULL THEN
    RAISE EXCEPTION 'attribution not found';
  END IF;

  -- Nettoyage données de mission liées (best-effort, tables optionnelles)
  BEGIN DELETE FROM public.inspection_photos WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.inspections WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_signatures WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_selfies WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_pv_digitaux WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_documents WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_incidents WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_locations WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_step_overrides WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.mission_etape_history WHERE attribution_id = _attribution_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Reset attribution
  UPDATE public.attributions
     SET statut = 'propose',
         etape_courante = NULL
   WHERE id = _attribution_id;

  -- Trajet repasse attribué (non terminé)
  UPDATE public.trajets
     SET statut = 'attribue',
         statut_publication = 'attribue'
   WHERE id = v_trajet_id;

  -- Trace
  INSERT INTO public.mission_etape_history (attribution_id, etape, notes)
  VALUES (_attribution_id, 'admin_reset', 'Mission réinitialisée par admin');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_mission(uuid) TO authenticated;
