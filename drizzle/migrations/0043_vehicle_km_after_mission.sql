CREATE TABLE IF NOT EXISTS public.vehicle_km_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  kilometrage integer NOT NULL,
  source text NOT NULL DEFAULT 'mission',
  inspection_id uuid,
  attribution_id uuid,
  statut text NOT NULL DEFAULT 'applique',
  auteur uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vkh_source_check CHECK (source IN ('mission','manuel','import')),
  CONSTRAINT vkh_statut_check CHECK (statut IN ('applique','a_verifier','confirme','corrige','conserve'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vkh_inspection ON public.vehicle_km_history(vehicle_id, inspection_id) WHERE inspection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vkh_vehicle ON public.vehicle_km_history(vehicle_id, created_at DESC);
GRANT SELECT ON public.vehicle_km_history TO authenticated;
GRANT ALL ON public.vehicle_km_history TO service_role;
ALTER TABLE public.vehicle_km_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY vkh_members_select ON public.vehicle_km_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY vkh_require_user_mfa ON public.vehicle_km_history AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.user_mfa_satisfied()));

CREATE OR REPLACE FUNCTION public.inspections_km_to_vehicle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plate text; v public.vehicles%ROWTYPE; n int; active boolean; suspicious boolean; m record;
BEGIN
  IF NEW.type <> 'arrivee' OR NEW.statut <> 'complete' OR NEW.kilometrage_arrivee IS NULL THEN RETURN NULL; END IF;
  SELECT upper(regexp_replace(COALESCE(t.immatriculation, t.vehicule_immatriculation, ''), '[^A-Za-z0-9]', '', 'g'))
    INTO plate FROM public.attributions a JOIN public.trajets t ON t.id = a.trajet_id WHERE a.id = NEW.attribution_id;
  IF COALESCE(plate, '') = '' THEN RETURN NULL; END IF;
  SELECT count(*) INTO n FROM public.vehicles
    WHERE archived_at IS NULL AND upper(regexp_replace(COALESCE(immatriculation,''), '[^A-Za-z0-9]', '', 'g')) = plate;
  IF n <> 1 THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.vehicles
    WHERE archived_at IS NULL AND upper(regexp_replace(COALESCE(immatriculation,''), '[^A-Za-z0-9]', '', 'g')) = plate;
  IF EXISTS (SELECT 1 FROM public.vehicle_km_history WHERE vehicle_id = v.id AND inspection_id = NEW.id) THEN RETURN NULL; END IF;

  active := COALESCE((v.automatismes->'kmAuto'->>'on')::boolean, true);
  IF NOT active THEN RETURN NULL; END IF;
  suspicious := v.kilometrage IS NOT NULL AND (NEW.kilometrage_arrivee < v.kilometrage OR NEW.kilometrage_arrivee - v.kilometrage > 3000);

  INSERT INTO public.vehicle_km_history(vehicle_id, organization_id, kilometrage, source, inspection_id, attribution_id, statut)
    VALUES (v.id, v.organization_id, NEW.kilometrage_arrivee, 'mission', NEW.id, NEW.attribution_id, CASE WHEN suspicious THEN 'a_verifier' ELSE 'applique' END);

  IF suspicious THEN
    INSERT INTO public.vehicle_automation_logs(vehicle_id, organization_id, automatisme, message, details)
      VALUES (v.id, v.organization_id, 'kilometrage', 'Kilométrage à vérifier : relevé ' || NEW.kilometrage_arrivee || ' km, fiche ' || v.kilometrage || ' km',
        jsonb_build_object('releve', NEW.kilometrage_arrivee, 'actuel', v.kilometrage, 'attribution_id', NEW.attribution_id, 'inspection_id', NEW.id));
    FOR m IN SELECT user_id FROM public.organization_members
      WHERE organization_id = v.organization_id AND status = 'active' AND member_role IN ('owner','admin','manager','logistique')
    LOOP
      PERFORM public.create_user_notification(m.user_id, 'vehicule_km_a_verifier', 'Kilométrage à vérifier : ' || COALESCE(v.immatriculation,'véhicule'),
        'Relevé du convoyeur : ' || NEW.kilometrage_arrivee || ' km. Fiche actuelle : ' || v.kilometrage || ' km. Confirmez ou corrigez depuis la fiche du véhicule.',
        '/dashboard-pro/flotte', 'mission', 'normal', 'km-verif-' || NEW.id, 'vehicle', v.id, '{}'::jsonb);
    END LOOP;
  ELSE
    UPDATE public.vehicles SET kilometrage = NEW.kilometrage_arrivee WHERE id = v.id;
    INSERT INTO public.vehicle_automation_logs(vehicle_id, organization_id, automatisme, message, details)
      VALUES (v.id, v.organization_id, 'kilometrage', 'Kilométrage mis à jour : ' || NEW.kilometrage_arrivee || ' km',
        jsonb_build_object('attribution_id', NEW.attribution_id, 'inspection_id', NEW.id));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_inspections_km_to_vehicle ON public.inspections;
CREATE TRIGGER trg_inspections_km_to_vehicle
  AFTER INSERT OR UPDATE OF statut, kilometrage_arrivee ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.inspections_km_to_vehicle();

CREATE OR REPLACE FUNCTION public.flotte_resolve_km(_history_id uuid, _km integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.vehicle_km_history%ROWTYPE; final_km integer;
BEGIN
  SELECT * INTO h FROM public.vehicle_km_history WHERE id = _history_id AND statut = 'a_verifier';
  IF NOT FOUND THEN RAISE EXCEPTION 'Relevé introuvable'; END IF;
  IF NOT (public.is_org_admin(h.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _km IS NOT NULL AND _km < 0 THEN RAISE EXCEPTION 'Valeur invalide'; END IF;
  final_km := COALESCE(_km, h.kilometrage);
  UPDATE public.vehicles SET kilometrage = final_km WHERE id = h.vehicle_id;
  UPDATE public.vehicle_km_history SET statut = CASE WHEN _km IS NULL THEN 'confirme' ELSE 'corrige' END, auteur = auth.uid() WHERE id = h.id;
  IF _km IS NOT NULL THEN
    INSERT INTO public.vehicle_km_history(vehicle_id, organization_id, kilometrage, source, statut, auteur)
      VALUES (h.vehicle_id, h.organization_id, _km, 'manuel', 'applique', auth.uid());
  END IF;
  INSERT INTO public.vehicle_automation_logs(vehicle_id, organization_id, automatisme, message, details)
    VALUES (h.vehicle_id, h.organization_id, 'kilometrage', 'Kilométrage mis à jour : ' || final_km || ' km (validé par le gestionnaire)', jsonb_build_object('history_id', h.id));
END $$;

REVOKE ALL ON FUNCTION public.inspections_km_to_vehicle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flotte_resolve_km(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flotte_resolve_km(uuid, integer) TO authenticated;