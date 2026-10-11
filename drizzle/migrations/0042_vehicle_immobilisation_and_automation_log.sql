ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS statut_precedent text,
  ADD COLUMN IF NOT EXISTS immobilisation_motif text,
  ADD COLUMN IF NOT EXISTS immobilisation_auto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS immobilise_le timestamptz;

CREATE TABLE IF NOT EXISTS public.vehicle_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  automatisme text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_val_vehicle ON public.vehicle_automation_logs(vehicle_id, created_at DESC);
GRANT SELECT ON public.vehicle_automation_logs TO authenticated;
GRANT ALL ON public.vehicle_automation_logs TO service_role;
ALTER TABLE public.vehicle_automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY val_members_select ON public.vehicle_automation_logs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY val_require_user_mfa ON public.vehicle_automation_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.user_mfa_satisfied()));

CREATE OR REPLACE FUNCTION public.vehicle_check_immobilisation(_vehicle_id uuid, _today date DEFAULT ((now() AT TIME ZONE 'Europe/Paris')::date))
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.vehicles%ROWTYPE;
  active boolean;
  reason text;
  plate text;
  action text := 'none';
  m record;
BEGIN
  SELECT * INTO v FROM public.vehicles WHERE id = _vehicle_id;
  IF NOT FOUND OR v.statut = 'archive' OR v.archived_at IS NOT NULL THEN RETURN 'none'; END IF;
  active := COALESCE((v.automatismes->'immobiliser'->>'on')::boolean, false);
  IF v.controle_technique_expire_le IS NOT NULL AND v.controle_technique_expire_le < _today THEN
    reason := 'Contrôle technique expiré le ' || to_char(v.controle_technique_expire_le, 'DD/MM/YYYY');
  ELSIF v.assurance_expire_le IS NOT NULL AND v.assurance_expire_le < _today THEN
    reason := 'Assurance expirée le ' || to_char(v.assurance_expire_le, 'DD/MM/YYYY');
  END IF;
  plate := COALESCE(v.immatriculation, 'Véhicule');

  IF active AND reason IS NOT NULL AND v.statut <> 'indispo' THEN
    UPDATE public.vehicles SET statut_precedent = v.statut, statut = 'indispo', immobilisation_motif = reason,
      immobilisation_auto = true, immobilise_le = now() WHERE id = v.id;
    INSERT INTO public.vehicle_automation_logs(vehicle_id, organization_id, automatisme, message, details)
      VALUES (v.id, v.organization_id, 'immobilisation', 'Statut passé à Immobilisé : ' || reason, jsonb_build_object('statut_precedent', v.statut));
    action := 'immobilise';
  ELSIF v.immobilisation_auto AND v.statut = 'indispo' AND reason IS NULL THEN
    UPDATE public.vehicles SET statut = COALESCE(statut_precedent, 'actif'), statut_precedent = NULL,
      immobilisation_motif = NULL, immobilisation_auto = false, immobilise_le = NULL WHERE id = v.id;
    INSERT INTO public.vehicle_automation_logs(vehicle_id, organization_id, automatisme, message, details)
      VALUES (v.id, v.organization_id, 'immobilisation', 'Remis en service : document à jour', jsonb_build_object('statut', COALESCE(v.statut_precedent, 'actif')));
    action := 'remis';
  END IF;

  IF action <> 'none' THEN
    FOR m IN SELECT user_id FROM public.organization_members
      WHERE organization_id = v.organization_id AND status = 'active' AND member_role IN ('owner','admin','manager','logistique')
    LOOP
      PERFORM public.create_user_notification(
        m.user_id, 'vehicule_' || action,
        CASE WHEN action = 'immobilise' THEN 'Véhicule immobilisé : ' || plate ELSE 'Véhicule remis en service : ' || plate END,
        CASE WHEN action = 'immobilise' THEN reason || '. Les missions déjà planifiées ne sont pas annulées : vérifiez-les.' ELSE 'Le document a été mis à jour, le véhicule reprend son statut précédent.' END,
        '/dashboard-pro/flotte', 'document', CASE WHEN action = 'immobilise' THEN 'high' ELSE 'normal' END,
        'vehicule-' || action || '-' || v.id || '-' || _today, 'vehicle', v.id, '{}'::jsonb);
    END LOOP;
  END IF;
  RETURN action;
END $$;

CREATE OR REPLACE FUNCTION public.vehicles_immobilisation_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.vehicle_check_immobilisation(NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_vehicles_immobilisation ON public.vehicles;
CREATE TRIGGER trg_vehicles_immobilisation
  AFTER INSERT OR UPDATE OF controle_technique_expire_le, assurance_expire_le, automatismes ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.vehicles_immobilisation_trigger();

CREATE OR REPLACE FUNCTION public.run_vehicle_automations(_today date DEFAULT ((now() AT TIME ZONE 'Europe/Paris')::date))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; a text; n_imm int := 0; n_rem int := 0; n_tot int := 0;
BEGIN
  FOR r IN SELECT id FROM public.vehicles WHERE archived_at IS NULL AND statut <> 'archive' LOOP
    a := public.vehicle_check_immobilisation(r.id, _today);
    n_tot := n_tot + 1;
    IF a = 'immobilise' THEN n_imm := n_imm + 1; ELSIF a = 'remis' THEN n_rem := n_rem + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('date', _today, 'vehicules', n_tot, 'immobilises', n_imm, 'remis', n_rem);
END $$;

CREATE OR REPLACE FUNCTION public.admin_run_vehicle_automations(_today date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.run_vehicle_automations(COALESCE(_today, (now() AT TIME ZONE 'Europe/Paris')::date));
END $$;

REVOKE ALL ON FUNCTION public.vehicle_check_immobilisation(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_vehicle_automations(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vehicles_immobilisation_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_run_vehicle_automations(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_vehicle_automations(date) TO authenticated;