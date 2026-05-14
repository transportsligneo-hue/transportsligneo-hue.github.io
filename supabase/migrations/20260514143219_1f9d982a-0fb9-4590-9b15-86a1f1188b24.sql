-- =====================================================================
-- 1) Purge immédiate des données opérationnelles (sécurisée par CASCADE)
--    Conserve : convoyeurs, profiles, devis, factures, b2b_*, contact_messages
-- =====================================================================
BEGIN;

DELETE FROM public.mission_locations;
DELETE FROM public.mission_etape_history;
DELETE FROM public.mission_step_overrides;
DELETE FROM public.mission_selfies;
DELETE FROM public.mission_signatures;
DELETE FROM public.mission_documents;
DELETE FROM public.mission_incidents;
DELETE FROM public.inspection_photos;
DELETE FROM public.inspection_document_ocr;
DELETE FROM public.inspections;
DELETE FROM public.mission_offres;
DELETE FROM public.attributions;
DELETE FROM public.trajets;
DELETE FROM public.missions;

-- Reset compteurs MIS-TLG pour repartir sur 001
DELETE FROM public.mission_sequences WHERE prefix = 'MIS-TLG';

COMMIT;

-- =====================================================================
-- 2) Fonction admin réutilisable : "Reset opérationnel complet"
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_operational_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_report jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  -- Ordre = enfants avant parents pour respecter les dépendances logiques
  DELETE FROM public.mission_locations;          GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_locations', v_count);
  DELETE FROM public.mission_etape_history;      GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_etape_history', v_count);
  DELETE FROM public.mission_step_overrides;     GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_step_overrides', v_count);
  DELETE FROM public.mission_selfies;            GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_selfies', v_count);
  DELETE FROM public.mission_signatures;         GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_signatures', v_count);
  DELETE FROM public.mission_documents;          GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_documents', v_count);
  DELETE FROM public.mission_incidents;          GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_incidents', v_count);
  DELETE FROM public.inspection_photos;          GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('inspection_photos', v_count);
  DELETE FROM public.inspection_document_ocr;    GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('inspection_document_ocr', v_count);
  DELETE FROM public.inspections;                GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('inspections', v_count);
  DELETE FROM public.mission_offres;             GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('mission_offres', v_count);
  DELETE FROM public.attributions;               GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('attributions', v_count);
  DELETE FROM public.trajets;                    GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('trajets', v_count);
  DELETE FROM public.missions;                   GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('missions', v_count);

  DELETE FROM public.mission_sequences WHERE prefix = 'MIS-TLG';

  -- Trace dans activity_logs (best-effort)
  BEGIN
    INSERT INTO public.activity_logs (actor_user_id, action, entity_type, metadata)
    VALUES (v_uid, 'admin_reset_operational_data', 'system', v_report);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_report;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_operational_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_operational_data() TO authenticated;