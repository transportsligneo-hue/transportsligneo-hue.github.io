CREATE TABLE public.conducteurs_flotte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  numero_permis text,
  permis_categorie text,
  permis_expiration date,
  statut text NOT NULL DEFAULT 'actif',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conducteurs_flotte_org ON public.conducteurs_flotte (organization_id, statut);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conducteurs_flotte TO authenticated;
GRANT ALL ON public.conducteurs_flotte TO service_role;
ALTER TABLE public.conducteurs_flotte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conducteurs_flotte_members_select" ON public.conducteurs_flotte
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "conducteurs_flotte_admins_insert" ON public.conducteurs_flotte
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "conducteurs_flotte_admins_update" ON public.conducteurs_flotte
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "conducteurs_flotte_admins_delete" ON public.conducteurs_flotte
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TABLE public.conducteur_vehicules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conducteur_id uuid NOT NULL REFERENCES public.conducteurs_flotte(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  is_principal boolean NOT NULL DEFAULT false,
  date_debut date NOT NULL DEFAULT current_date,
  date_fin date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conducteur_vehicules_cond ON public.conducteur_vehicules (conducteur_id, date_fin);
CREATE INDEX idx_conducteur_vehicules_veh ON public.conducteur_vehicules (vehicle_id, date_fin);
CREATE UNIQUE INDEX uniq_conducteur_vehicule_actif ON public.conducteur_vehicules (conducteur_id, vehicle_id) WHERE date_fin IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conducteur_vehicules TO authenticated;
GRANT ALL ON public.conducteur_vehicules TO service_role;
ALTER TABLE public.conducteur_vehicules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conducteur_vehicules_members_select" ON public.conducteur_vehicules
  FOR SELECT TO authenticated
  USING (public.fleet_can_view_vehicle(vehicle_id, auth.uid()));

CREATE POLICY "conducteur_vehicules_admins_insert" ON public.conducteur_vehicules
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))));

CREATE POLICY "conducteur_vehicules_admins_update" ON public.conducteur_vehicules
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))));

CREATE POLICY "conducteur_vehicules_admins_delete" ON public.conducteur_vehicules
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND (public.is_org_admin(v.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))));

ALTER TABLE public.vehicle_movements ADD COLUMN IF NOT EXISTS conducteur_id uuid REFERENCES public.conducteurs_flotte(id) ON DELETE SET NULL;

CREATE TRIGGER trg_conducteurs_flotte_updated
  BEFORE UPDATE ON public.conducteurs_flotte
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_conducteur_vehicules_updated
  BEFORE UPDATE ON public.conducteur_vehicules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();