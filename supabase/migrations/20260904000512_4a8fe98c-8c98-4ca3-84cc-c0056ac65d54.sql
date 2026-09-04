-- 1. Véhicules : champs de fin de vie
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fin_de_vie_prevue date,
  ADD COLUMN IF NOT EXISTS valeur_revente_estimee numeric;

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_statut_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_statut_check
  CHECK (statut IN ('actif','en_mission','indispo','en_vente','sorti','archive'));

-- 2. Périmètre par site
CREATE TABLE IF NOT EXISTS public.organization_member_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.organization_sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, site_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_member_sites TO authenticated;
GRANT ALL ON public.organization_member_sites TO service_role;
ALTER TABLE public.organization_member_sites ENABLE ROW LEVEL SECURITY;

-- 3. Fonctions de périmètre (security definer, pas de récursion RLS)
CREATE OR REPLACE FUNCTION public.fleet_member_role(_org_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT member_role FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active'
  ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.fleet_is_global_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.fleet_can_view_vehicle(_vehicle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_site uuid; v_role text; v_member uuid; v_scoped int;
BEGIN
  IF public.fleet_is_global_admin(_user_id) THEN RETURN true; END IF;
  SELECT organization_id, site_id INTO v_org, v_site FROM public.vehicles WHERE id = _vehicle_id;
  IF v_org IS NULL THEN RETURN false; END IF;
  SELECT id, member_role INTO v_member, v_role FROM public.organization_members
   WHERE organization_id = v_org AND user_id = _user_id AND status = 'active'
   ORDER BY created_at LIMIT 1;
  IF v_member IS NULL THEN RETURN false; END IF;
  IF v_role IN ('owner','admin','fleet_admin') THEN RETURN true; END IF;
  SELECT count(*) INTO v_scoped FROM public.organization_member_sites WHERE member_id = v_member;
  IF v_scoped = 0 THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organization_member_sites
    WHERE member_id = v_member AND site_id = v_site
  );
END $$;

CREATE OR REPLACE FUNCTION public.fleet_can_manage_costs(_vehicle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_role text;
BEGIN
  IF public.fleet_is_global_admin(_user_id) THEN RETURN true; END IF;
  SELECT organization_id INTO v_org FROM public.vehicles WHERE id = _vehicle_id;
  IF v_org IS NULL THEN RETURN false; END IF;
  v_role := public.fleet_member_role(v_org, _user_id);
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN v_role IN ('owner','admin','fleet_admin','fleet_finance')
     AND public.fleet_can_view_vehicle(_vehicle_id, _user_id);
END $$;

CREATE POLICY member_sites_read ON public.organization_member_sites FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m
  WHERE m.id = member_id AND (public.is_org_member(m.organization_id, auth.uid()) OR public.fleet_is_global_admin(auth.uid()))));
CREATE POLICY member_sites_manage ON public.organization_member_sites FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m
  WHERE m.id = member_id AND (public.is_org_admin(m.organization_id, auth.uid())
    OR public.fleet_member_role(m.organization_id, auth.uid()) = 'fleet_admin'
    OR public.fleet_is_global_admin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
  WHERE m.id = member_id AND (public.is_org_admin(m.organization_id, auth.uid())
    OR public.fleet_member_role(m.organization_id, auth.uid()) = 'fleet_admin'
    OR public.fleet_is_global_admin(auth.uid()))));

-- 4. Contrats de financement
CREATE TABLE IF NOT EXISTS public.vehicle_finance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('achat_comptant','lld','loa','credit_bail')),
  valeur_acquisition numeric,
  loyer_mensuel numeric,
  duree_mois integer,
  date_debut date,
  date_fin date,
  valeur_residuelle numeric,
  organisme text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_finance_contracts_vehicle_idx ON public.vehicle_finance_contracts(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_finance_contracts TO authenticated;
GRANT ALL ON public.vehicle_finance_contracts TO service_role;
ALTER TABLE public.vehicle_finance_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY vfc_read ON public.vehicle_finance_contracts FOR SELECT TO authenticated
  USING (public.fleet_can_view_vehicle(vehicle_id, auth.uid()));
CREATE POLICY vfc_manage ON public.vehicle_finance_contracts FOR ALL TO authenticated
  USING (public.fleet_can_manage_costs(vehicle_id, auth.uid()))
  WITH CHECK (public.fleet_can_manage_costs(vehicle_id, auth.uid()));

-- 5. Coûts véhicule
CREATE TABLE IF NOT EXISTS public.vehicle_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  categorie text NOT NULL CHECK (categorie IN (
    'carburant','entretien','assurance','pneumatiques','peages','amendes',
    'convoyage','financement','taxes','depreciation','autre')),
  montant numeric NOT NULL CHECK (montant >= 0),
  date_cout date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel','mission','facture','import')),
  libelle text,
  justificatif_path text,
  mission_id uuid,
  trajet_id uuid,
  facture_id uuid,
  kilometrage integer,
  notes text,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','archive')),
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_costs_vehicle_date_idx ON public.vehicle_costs(vehicle_id, date_cout DESC);
CREATE INDEX IF NOT EXISTS vehicle_costs_categorie_idx ON public.vehicle_costs(categorie);
CREATE INDEX IF NOT EXISTS vehicle_costs_statut_idx ON public.vehicle_costs(statut);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_costs_convoyage_unique
  ON public.vehicle_costs(vehicle_id, mission_id) WHERE categorie = 'convoyage' AND mission_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_costs_convoyage_trajet_unique
  ON public.vehicle_costs(vehicle_id, trajet_id) WHERE categorie = 'convoyage' AND trajet_id IS NOT NULL AND mission_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_costs TO authenticated;
GRANT ALL ON public.vehicle_costs TO service_role;
ALTER TABLE public.vehicle_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY vcost_read ON public.vehicle_costs FOR SELECT TO authenticated
  USING (public.fleet_can_view_vehicle(vehicle_id, auth.uid()));
CREATE POLICY vcost_manage ON public.vehicle_costs FOR ALL TO authenticated
  USING (public.fleet_can_manage_costs(vehicle_id, auth.uid()))
  WITH CHECK (public.fleet_can_manage_costs(vehicle_id, auth.uid()));

-- 6. Révisions et contrôles
CREATE TABLE IF NOT EXISTS public.vehicle_service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('controle_technique','revision_constructeur','pneumatiques','autre')),
  date_prevue date,
  date_realisee date,
  kilometrage_prevu integer,
  statut text NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie','realise','annule')),
  cost_id uuid REFERENCES public.vehicle_costs(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_service_events_vehicle_idx ON public.vehicle_service_events(vehicle_id, date_prevue);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_service_events TO authenticated;
GRANT ALL ON public.vehicle_service_events TO service_role;
ALTER TABLE public.vehicle_service_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY vse_read ON public.vehicle_service_events FOR SELECT TO authenticated
  USING (public.fleet_can_view_vehicle(vehicle_id, auth.uid()));
CREATE POLICY vse_manage ON public.vehicle_service_events FOR ALL TO authenticated
  USING (public.fleet_can_manage_costs(vehicle_id, auth.uid()))
  WITH CHECK (public.fleet_can_manage_costs(vehicle_id, auth.uid()));

-- 7. Audit des coûts
CREATE TABLE IF NOT EXISTS public.vehicle_cost_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','archive')),
  actor_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_cost_audit_cost_idx ON public.vehicle_cost_audit(cost_id, created_at DESC);
GRANT SELECT ON public.vehicle_cost_audit TO authenticated;
GRANT ALL ON public.vehicle_cost_audit TO service_role;
ALTER TABLE public.vehicle_cost_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY vca_read ON public.vehicle_cost_audit FOR SELECT TO authenticated
  USING (public.fleet_can_view_vehicle(vehicle_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.vehicle_costs_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vehicle_cost_audit(cost_id, vehicle_id, action, actor_id, after_data)
    VALUES (NEW.id, NEW.vehicle_id, 'create', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    NEW.updated_at := now();
    INSERT INTO public.vehicle_cost_audit(cost_id, vehicle_id, action, actor_id, before_data, after_data)
    VALUES (NEW.id, NEW.vehicle_id,
      CASE WHEN NEW.statut = 'archive' AND OLD.statut <> 'archive' THEN 'archive' ELSE 'update' END,
      auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS vehicle_costs_audit ON public.vehicle_costs;
CREATE TRIGGER vehicle_costs_audit
  AFTER INSERT ON public.vehicle_costs
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_costs_audit_trigger();
DROP TRIGGER IF EXISTS vehicle_costs_audit_upd ON public.vehicle_costs;
CREATE TRIGGER vehicle_costs_audit_upd
  BEFORE UPDATE ON public.vehicle_costs
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_costs_audit_trigger();

-- Interdire la suppression réelle des coûts (archivage uniquement)
CREATE OR REPLACE FUNCTION public.vehicle_costs_block_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Les coûts ne peuvent pas être supprimés, seulement archivés.'
    USING ERRCODE = 'check_violation';
END $$;
DROP TRIGGER IF EXISTS vehicle_costs_no_delete ON public.vehicle_costs;
CREATE TRIGGER vehicle_costs_no_delete BEFORE DELETE ON public.vehicle_costs
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_costs_block_delete();

-- 8. Réglages flotte
CREATE TABLE IF NOT EXISTS public.fleet_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  tco_ecart_seuil_pct numeric NOT NULL DEFAULT 20,
  alert_emails text[] NOT NULL DEFAULT '{}',
  alertes_email_actives boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_settings TO authenticated;
GRANT ALL ON public.fleet_settings TO service_role;
ALTER TABLE public.fleet_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY fleet_settings_read ON public.fleet_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.fleet_is_global_admin(auth.uid()));
CREATE POLICY fleet_settings_manage ON public.fleet_settings FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())
      OR public.fleet_member_role(organization_id, auth.uid()) IN ('fleet_admin','fleet_finance')
      OR public.fleet_is_global_admin(auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid())
      OR public.fleet_member_role(organization_id, auth.uid()) IN ('fleet_admin','fleet_finance')
      OR public.fleet_is_global_admin(auth.uid()));

-- 9. Alimentation automatique du coût de convoyage
CREATE OR REPLACE FUNCTION public.sync_convoyage_cost(_vehicle_id uuid, _mission_id uuid, _trajet_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_montant numeric; v_date date; v_lib text;
BEGIN
  IF _vehicle_id IS NULL THEN RETURN; END IF;
  IF _mission_id IS NOT NULL THEN
    SELECT coalesce(prix_total, 0), coalesce(date_prise_en_charge, current_date),
           'Convoyage ' || coalesce(numero, '') || ' · ' || coalesce(ville_depart,'') || ' → ' || coalesce(ville_arrivee,'')
      INTO v_montant, v_date, v_lib FROM public.missions WHERE id = _mission_id;
  ELSIF _trajet_id IS NOT NULL THEN
    SELECT coalesce(prix_client, prix, 0), coalesce(date_trajet, current_date),
           'Convoyage · ' || coalesce(depart,'') || ' → ' || coalesce(arrivee,'')
      INTO v_montant, v_date, v_lib FROM public.trajets WHERE id = _trajet_id;
  ELSE
    RETURN;
  END IF;
  IF v_montant IS NULL OR v_montant <= 0 THEN RETURN; END IF;
  INSERT INTO public.vehicle_costs (vehicle_id, categorie, montant, date_cout, source, libelle, mission_id, trajet_id)
  VALUES (_vehicle_id, 'convoyage', v_montant, v_date, 'mission', v_lib, _mission_id, _trajet_id)
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.trg_vehicle_movement_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_convoyage_cost(NEW.vehicle_id, NEW.mission_id, NEW.trajet_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vehicle_movements_cost ON public.vehicle_movements;
CREATE TRIGGER vehicle_movements_cost AFTER INSERT ON public.vehicle_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_vehicle_movement_cost();

CREATE OR REPLACE FUNCTION public.trg_attribution_convoyage_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.statut = 'termine' AND (OLD.statut IS DISTINCT FROM NEW.statut) THEN
    FOR r IN SELECT vehicle_id, mission_id, trajet_id FROM public.vehicle_movements
             WHERE trajet_id = NEW.trajet_id OR mission_id IN (
               SELECT id FROM public.missions WHERE id = NEW.trajet_id)
    LOOP
      PERFORM public.sync_convoyage_cost(r.vehicle_id, r.mission_id, r.trajet_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS attributions_convoyage_cost ON public.attributions;
CREATE TRIGGER attributions_convoyage_cost AFTER UPDATE ON public.attributions
  FOR EACH ROW EXECUTE FUNCTION public.trg_attribution_convoyage_cost();

-- 10. Calcul du TCO (toujours recalculé)
CREATE OR REPLACE FUNCTION public.get_vehicle_tco(_vehicle_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_total numeric; v_by jsonb; v_months numeric; v_revente numeric;
BEGIN
  IF NOT public.fleet_can_view_vehicle(_vehicle_id, auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = _vehicle_id;
  SELECT coalesce(sum(montant), 0),
         coalesce(jsonb_object_agg(categorie, cat_total), '{}'::jsonb)
    INTO v_total, v_by
  FROM (
    SELECT categorie, sum(montant) cat_total FROM public.vehicle_costs
    WHERE vehicle_id = _vehicle_id AND statut = 'actif'
      AND (_from IS NULL OR date_cout >= _from)
      AND (_to IS NULL OR date_cout <= _to)
    GROUP BY categorie
  ) s, LATERAL (SELECT s.cat_total AS montant) m;
  v_revente := CASE WHEN v.statut = 'sorti' THEN coalesce(v.valeur_revente_estimee, 0) ELSE 0 END;
  v_months := GREATEST(1, EXTRACT(EPOCH FROM (now() - coalesce(v.mise_en_circulation::timestamptz, v.created_at))) / 2629800);
  RETURN jsonb_build_object(
    'vehicle_id', _vehicle_id,
    'total', v_total - v_revente,
    'brut', v_total,
    'revente', v_revente,
    'par_categorie', v_by,
    'kilometrage', coalesce(v.kilometrage, 0),
    'tco_km', CASE WHEN coalesce(v.kilometrage,0) > 0 THEN (v_total - v_revente) / v.kilometrage ELSE NULL END,
    'tco_mensuel', (v_total - v_revente) / v_months,
    'mois_service', round(v_months, 1)
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_fleet_tco(_org_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL, _site_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb; v_total numeric; v_by jsonb;
BEGIN
  IF NOT (public.is_org_member(_org_id, auth.uid()) OR public.fleet_is_global_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  WITH visibles AS (
    SELECT v.* FROM public.vehicles v
    WHERE v.organization_id = _org_id
      AND (_site_id IS NULL OR v.site_id = _site_id)
      AND public.fleet_can_view_vehicle(v.id, auth.uid())
  ), couts AS (
    SELECT c.vehicle_id, c.categorie, sum(c.montant) montant
    FROM public.vehicle_costs c JOIN visibles v ON v.id = c.vehicle_id
    WHERE c.statut = 'actif'
      AND (_from IS NULL OR c.date_cout >= _from)
      AND (_to IS NULL OR c.date_cout <= _to)
    GROUP BY 1,2
  ), par_vehicule AS (
    SELECT v.id, v.immatriculation, v.marque, v.modele, v.type_vehicule, v.site_id,
           coalesce(v.kilometrage,0) km,
           coalesce((SELECT sum(montant) FROM couts c WHERE c.vehicle_id = v.id), 0) total
    FROM visibles v
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'immatriculation', immatriculation, 'marque', marque, 'modele', modele,
           'type_vehicule', type_vehicule, 'site_id', site_id, 'kilometrage', km,
           'total', total, 'tco_km', CASE WHEN km > 0 THEN total / km ELSE NULL END
         ) ORDER BY total DESC), '[]'::jsonb),
         coalesce(sum(total), 0)
    INTO v_rows, v_total FROM par_vehicule;

  SELECT coalesce(jsonb_object_agg(categorie, montant), '{}'::jsonb) INTO v_by
  FROM (SELECT categorie, sum(montant) montant FROM public.vehicle_costs c
        WHERE c.statut = 'actif'
          AND c.vehicle_id IN (SELECT id FROM public.vehicles WHERE organization_id = _org_id AND (_site_id IS NULL OR site_id = _site_id))
          AND (_from IS NULL OR c.date_cout >= _from)
          AND (_to IS NULL OR c.date_cout <= _to)
        GROUP BY 1) t;

  RETURN jsonb_build_object('total', v_total, 'par_categorie', v_by, 'vehicules', v_rows);
END $$;

-- 11. Alertes flotte
CREATE OR REPLACE FUNCTION public.get_fleet_alerts(_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seuil numeric; v_out jsonb;
BEGIN
  IF NOT (public.is_org_member(_org_id, auth.uid()) OR public.fleet_is_global_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  SELECT coalesce(tco_ecart_seuil_pct, 20) INTO v_seuil FROM public.fleet_settings WHERE organization_id = _org_id;
  v_seuil := coalesce(v_seuil, 20);

  WITH visibles AS (
    SELECT v.* FROM public.vehicles v
    WHERE v.organization_id = _org_id AND v.statut <> 'archive'
      AND public.fleet_can_view_vehicle(v.id, auth.uid())
  ), tco AS (
    SELECT v.id, v.type_vehicule, coalesce(v.kilometrage,0) km,
           coalesce((SELECT sum(c.montant) FROM public.vehicle_costs c WHERE c.vehicle_id = v.id AND c.statut='actif'),0) total
    FROM visibles v
  ), tco_km AS (
    SELECT id, type_vehicule, CASE WHEN km > 0 THEN total/km ELSE NULL END val FROM tco
  ), moyennes AS (
    SELECT type_vehicule, avg(val) moy FROM tco_km WHERE val IS NOT NULL GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(a ORDER BY a->>'severite'), '[]'::jsonb) INTO v_out FROM (
    SELECT jsonb_build_object('type','controle_technique','vehicle_id', v.id,
      'immatriculation', v.immatriculation, 'date', v.controle_technique_expire_le,
      'severite', CASE WHEN v.controle_technique_expire_le < current_date THEN 'critique'
                       WHEN v.controle_technique_expire_le <= current_date + 7 THEN 'critique'
                       WHEN v.controle_technique_expire_le <= current_date + 15 THEN 'haute' ELSE 'moyenne' END) a
    FROM visibles v WHERE v.controle_technique_expire_le IS NOT NULL
      AND v.controle_technique_expire_le <= current_date + 30
    UNION ALL
    SELECT jsonb_build_object('type','revision','vehicle_id', v.id,
      'immatriculation', v.immatriculation, 'km_restants', v.prochaine_revision_km - coalesce(v.kilometrage,0),
      'severite', CASE WHEN coalesce(v.kilometrage,0) >= v.prochaine_revision_km THEN 'critique' ELSE 'moyenne' END)
    FROM visibles v WHERE v.prochaine_revision_km IS NOT NULL
      AND coalesce(v.kilometrage,0) >= v.prochaine_revision_km - 1500
    UNION ALL
    SELECT jsonb_build_object('type','contrat','vehicle_id', v.id,
      'immatriculation', v.immatriculation, 'date', fc.date_fin, 'severite','haute')
    FROM visibles v JOIN public.vehicle_finance_contracts fc ON fc.vehicle_id = v.id
    WHERE fc.date_fin IS NOT NULL AND fc.date_fin <= current_date + 90
    UNION ALL
    SELECT jsonb_build_object('type','tco_eleve','vehicle_id', t.id,
      'immatriculation', v.immatriculation, 'tco_km', round(t.val::numeric, 3),
      'moyenne', round(m.moy::numeric, 3), 'severite','moyenne')
    FROM tco_km t JOIN moyennes m ON m.type_vehicule IS NOT DISTINCT FROM t.type_vehicule
    JOIN visibles v ON v.id = t.id
    WHERE t.val IS NOT NULL AND m.moy > 0 AND t.val > m.moy * (1 + v_seuil/100.0)
  ) x;
  RETURN v_out;
END $$;

-- 12. updated_at
DROP TRIGGER IF EXISTS vfc_touch ON public.vehicle_finance_contracts;
CREATE TRIGGER vfc_touch BEFORE UPDATE ON public.vehicle_finance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS vse_touch ON public.vehicle_service_events;
CREATE TRIGGER vse_touch BEFORE UPDATE ON public.vehicle_service_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS fleet_settings_touch ON public.fleet_settings;
CREATE TRIGGER fleet_settings_touch BEFORE UPDATE ON public.fleet_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();