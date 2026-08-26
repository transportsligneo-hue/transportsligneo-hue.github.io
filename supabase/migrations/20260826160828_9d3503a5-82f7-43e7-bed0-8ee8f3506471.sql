CREATE OR REPLACE FUNCTION public.admin_purge_trajet(_trajet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seed public.trajets%ROWTYPE;
  v_trajets uuid[];
  v_attrs uuid[];
  v_missions uuid[];
  v_rems uuid[];
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_seed
  FROM public.trajets
  WHERE id = _trajet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  SELECT coalesce(array_agg(DISTINCT t.id), '{}'::uuid[])
  INTO v_trajets
  FROM public.trajets t
  WHERE t.id = _trajet_id
     OR (v_seed.mission_group_id IS NOT NULL AND t.mission_group_id = v_seed.mission_group_id)
     OR t.parent_trajet_id = _trajet_id
     OR t.id = v_seed.parent_trajet_id
     OR (v_seed.parent_trajet_id IS NOT NULL AND t.parent_trajet_id = v_seed.parent_trajet_id)
     OR (v_seed.numero_mission IS NOT NULL AND t.numero_mission = v_seed.numero_mission);

  SELECT coalesce(array_agg(DISTINCT a.id), '{}'::uuid[])
  INTO v_attrs
  FROM public.attributions a
  WHERE a.trajet_id = ANY(v_trajets);

  SELECT coalesce(array_agg(DISTINCT t.mission_id) FILTER (WHERE t.mission_id IS NOT NULL), '{}'::uuid[])
  INTO v_missions
  FROM public.trajets t
  WHERE t.id = ANY(v_trajets);

  SELECT coalesce(array_agg(DISTINCT r.id), '{}'::uuid[])
  INTO v_rems
  FROM public.remunerations_missions r
  WHERE r.trajet_id = ANY(v_trajets)
     OR r.attribution_id = ANY(v_attrs);

  DELETE FROM public.remuneration_ajustements WHERE remuneration_id = ANY(v_rems);
  DELETE FROM public.remunerations_missions WHERE id = ANY(v_rems);

  DELETE FROM public.factures
  WHERE attribution_id = ANY(v_attrs)
     OR mission_id = ANY(v_missions);

  DELETE FROM public.mission_pv_digitaux WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_selfies WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_signatures WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_step_overrides WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.po_pdf_history WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.inspection_document_ocr WHERE attribution_id = ANY(v_attrs);

  DELETE FROM public.attributions WHERE id = ANY(v_attrs);
  DELETE FROM public.mission_offres WHERE trajet_id = ANY(v_trajets);
  DELETE FROM public.vehicle_movements
  WHERE trajet_id = ANY(v_trajets)
     OR mission_id = ANY(v_missions);
  DELETE FROM public.trajets_admin_data WHERE trajet_id = ANY(v_trajets);

  UPDATE public.trajets
  SET parent_trajet_id = NULL
  WHERE id = ANY(v_trajets)
    AND parent_trajet_id IS NOT NULL;

  DELETE FROM public.trajets WHERE id = ANY(v_trajets);

  DELETE FROM public.avis_clients WHERE mission_id = ANY(v_missions);
  DELETE FROM public.reviews WHERE mission_id = ANY(v_missions);
  DELETE FROM public.loyalty_redemptions WHERE mission_id = ANY(v_missions);
  DELETE FROM public.missions m
  WHERE m.id = ANY(v_missions)
    AND NOT EXISTS (SELECT 1 FROM public.trajets t WHERE t.mission_id = m.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_trajet(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_trajet(uuid) TO authenticated;