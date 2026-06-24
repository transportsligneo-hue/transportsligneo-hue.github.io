
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS mission_group_id uuid,
  ADD COLUMN IF NOT EXISTS leg_type text CHECK (leg_type IN ('simple','aller','retour')) DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS leg_index smallint DEFAULT 1;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS mission_group_id uuid,
  ADD COLUMN IF NOT EXISTS leg_type text CHECK (leg_type IN ('simple','aller','retour')) DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS leg_index smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bidding_enabled boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  r RECORD;
  v_group uuid;
BEGIN
  FOR r IN SELECT id, parent_trajet_id FROM public.trajets WHERE parent_trajet_id IS NOT NULL AND mission_group_id IS NULL LOOP
    SELECT mission_group_id INTO v_group FROM public.trajets WHERE id = r.parent_trajet_id;
    IF v_group IS NULL THEN
      v_group := gen_random_uuid();
      UPDATE public.trajets SET mission_group_id = v_group, leg_type = 'aller' WHERE id = r.parent_trajet_id;
    END IF;
    UPDATE public.trajets SET mission_group_id = v_group, leg_type = 'retour', leg_index = 2 WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS old_value jsonb,
  ADD COLUMN IF NOT EXISTS new_value jsonb,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- organization_sites
CREATE TABLE IF NOT EXISTS public.organization_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  adresse text,
  ville text,
  code_postal text,
  pays text DEFAULT 'France',
  contact_nom text,
  contact_email text,
  contact_telephone text,
  actif boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_sites TO authenticated;
GRANT ALL ON public.organization_sites TO service_role;
ALTER TABLE public.organization_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_members_select" ON public.organization_sites
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "sites_admins_manage" ON public.organization_sites
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.organization_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_sites_org ON public.organization_sites(organization_id);

-- vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL,
  vin text,
  immatriculation text,
  marque text,
  modele text,
  energie text,
  type_vehicule text,
  couleur text,
  kilometrage integer,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','en_mission','indispo','archive')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_members_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "vehicles_admins_manage" ON public.vehicles
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- vehicle_movements
CREATE TABLE IF NOT EXISTS public.vehicle_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  trajet_id uuid REFERENCES public.trajets(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('livraison','restitution','transfert','autre')),
  from_address text,
  to_address text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vehicle_movements TO authenticated;
GRANT ALL ON public.vehicle_movements TO service_role;
ALTER TABLE public.vehicle_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements_members_select" ON public.vehicle_movements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = vehicle_movements.vehicle_id
      AND (public.is_org_member(v.organization_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  ));
CREATE POLICY "movements_admins_insert" ON public.vehicle_movements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = vehicle_movements.vehicle_id
      AND (public.is_org_admin(v.organization_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  ));

-- Index performance (trigram + composites)
CREATE INDEX IF NOT EXISTS idx_missions_vin_trgm ON public.missions USING gin (vin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_missions_imm_trgm ON public.missions USING gin (immatriculation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_missions_numero_trgm ON public.missions USING gin (numero gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_missions_group ON public.missions(mission_group_id);
CREATE INDEX IF NOT EXISTS idx_missions_org_statut_date ON public.missions(organization_id, statut, date_prise_en_charge DESC);
CREATE INDEX IF NOT EXISTS idx_missions_fleet_org ON public.missions(fleet_organization_id);

CREATE INDEX IF NOT EXISTS idx_trajets_vin_trgm ON public.trajets USING gin (vin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trajets_imm_trgm ON public.trajets USING gin (immatriculation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_trajets_group ON public.trajets(mission_group_id);

CREATE INDEX IF NOT EXISTS idx_demandes_imm_trgm ON public.demandes_convoyage USING gin (immatriculation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_devis_vin_trgm ON public.devis USING gin (vin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_devis_numero_trgm ON public.devis USING gin (numero gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vehicles_vin_trgm ON public.vehicles USING gin (vin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_imm_trgm ON public.vehicles USING gin (immatriculation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_org ON public.vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_statut ON public.vehicles(statut);

CREATE INDEX IF NOT EXISTS idx_movements_vehicle ON public.vehicle_movements(vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_mission ON public.vehicle_movements(mission_id);

-- auto_create_trajet_from_devis : propage mission_group_id
CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_livraison_id uuid;
  v_is_ar boolean;
  v_group uuid;
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL) THEN
    SELECT id INTO v_existing FROM public.trajets WHERE devis_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      v_is_ar := (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0);
      v_group := gen_random_uuid();

      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode,
        vin, carte_grise_recto_url, carte_grise_verso_url,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
        type_mission, commande_ref,
        mission_group_id, leg_type, leg_index
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        NEW.prix_estime, NEW.prix_estime, 65,
        'en_attente', 'brouillon', 'fixe',
        NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
        NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
        NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
        'livraison', NEW.numero,
        CASE WHEN v_is_ar THEN v_group ELSE NULL END,
        CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
        1
      ) RETURNING id INTO v_livraison_id;

      IF v_is_ar THEN
        INSERT INTO public.trajets (
          devis_id, depart, arrivee, date_trajet, heure_trajet,
          marque, modele, client_nom, client_email, client_telephone,
          prix_client, prix, commission_convoyeur_pct,
          statut, statut_publication, pricing_mode,
          vin,
          contact_depart_nom, contact_depart_tel, contact_depart_note,
          contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
          type_mission, commande_ref, parent_trajet_id, immatriculation,
          mission_group_id, leg_type, leg_index
        ) VALUES (
          NEW.id,
          CASE
            WHEN COALESCE(NEW.recuperation_retour_identique, true) THEN NEW.arrivee
            ELSE COALESCE(NULLIF(trim(COALESCE(NEW.adresse_recuperation_retour, '')), ''), NEW.depart_retour)
          END,
          COALESCE(NULLIF(trim(COALESCE(NEW.arrivee_retour, '')), ''), NEW.depart),
          COALESCE(NEW.date_retour, NEW.date_souhaitee), COALESCE(NEW.heure_retour, ''),
          COALESCE(NEW.marque_retour, NEW.marque, ''), COALESCE(NEW.modele_retour, NEW.modele, ''),
          TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
          NULL, 0, 65,
          CASE WHEN NEW.date_retour IS NOT NULL THEN 'en_attente' ELSE 'en_attente_planification' END,
          'brouillon', 'fixe',
          NEW.vin_retour,
          NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
          NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
          'restitution', NEW.numero, v_livraison_id, NEW.immatriculation_retour,
          v_group, 'retour', 2
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
