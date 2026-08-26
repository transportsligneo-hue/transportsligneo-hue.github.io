
CREATE OR REPLACE FUNCTION public.admin_purge_trajet(_trajet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attrs uuid[];
  v_mission uuid;
  v_rems uuid[];
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT mission_id INTO v_mission FROM public.trajets WHERE id = _trajet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_attrs FROM public.attributions WHERE trajet_id = _trajet_id;

  SELECT coalesce(array_agg(id), '{}') INTO v_rems
    FROM public.remunerations_missions
   WHERE trajet_id = _trajet_id OR attribution_id = ANY(v_attrs);

  DELETE FROM public.remuneration_ajustements WHERE remuneration_id = ANY(v_rems);
  DELETE FROM public.remunerations_missions WHERE id = ANY(v_rems);

  DELETE FROM public.factures WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_pv_digitaux WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_selfies WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_signatures WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.mission_step_overrides WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.po_pdf_history WHERE attribution_id = ANY(v_attrs);
  DELETE FROM public.inspection_document_ocr WHERE attribution_id = ANY(v_attrs);

  DELETE FROM public.attributions WHERE id = ANY(v_attrs);
  DELETE FROM public.mission_offres WHERE trajet_id = _trajet_id;
  DELETE FROM public.vehicle_movements WHERE trajet_id = _trajet_id;
  DELETE FROM public.trajets_admin_data WHERE trajet_id = _trajet_id;
  DELETE FROM public.trajets WHERE id = _trajet_id;

  IF v_mission IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.trajets WHERE mission_id = v_mission) THEN
      DELETE FROM public.factures WHERE mission_id = v_mission;
      DELETE FROM public.avis_clients WHERE mission_id = v_mission;
      DELETE FROM public.reviews WHERE mission_id = v_mission;
      DELETE FROM public.loyalty_redemptions WHERE mission_id = v_mission;
      DELETE FROM public.vehicle_movements WHERE mission_id = v_mission;
      DELETE FROM public.missions WHERE id = v_mission;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_purge_devis(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_t uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  FOR v_t IN SELECT id FROM public.trajets WHERE devis_id = _devis_id LOOP
    PERFORM public.admin_purge_trajet(v_t);
  END LOOP;

  UPDATE public.missions SET devis_id = NULL WHERE devis_id = _devis_id;
  UPDATE public.demandes_convoyage SET devis_id = NULL WHERE devis_id = _devis_id;
  DELETE FROM public.loyalty_redemptions WHERE devis_id = _devis_id;
  DELETE FROM public.devis_status_history WHERE devis_id = _devis_id;
  DELETE FROM public.devis_otp_challenges WHERE devis_id = _devis_id;
  DELETE FROM public.devis_acceptations WHERE devis_id = _devis_id;
  DELETE FROM public.devis WHERE id = _devis_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_purge_demande(_demande_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_t uuid;
  v_d uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  FOR v_t IN SELECT id FROM public.trajets WHERE demande_id = _demande_id LOOP
    PERFORM public.admin_purge_trajet(v_t);
  END LOOP;

  FOR v_d IN SELECT id FROM public.devis WHERE demande_id = _demande_id LOOP
    PERFORM public.admin_purge_devis(v_d);
  END LOOP;

  DELETE FROM public.demandes_convoyage WHERE id = _demande_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_trajet(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_purge_devis(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_purge_demande(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_trajet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_devis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_demande(uuid) TO authenticated;
