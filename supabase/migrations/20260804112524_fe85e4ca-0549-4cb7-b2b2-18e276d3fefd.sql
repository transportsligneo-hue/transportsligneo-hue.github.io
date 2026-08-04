ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assurance_expire_le date,
  ADD COLUMN IF NOT EXISTS controle_technique_expire_le date,
  ADD COLUMN IF NOT EXISTS carte_grise_expire_le date,
  ADD COLUMN IF NOT EXISTS mise_en_circulation date,
  ADD COLUMN IF NOT EXISTS assurance_cout_annuel numeric(12,2),
  ADD COLUMN IF NOT EXISTS prochaine_revision_km integer,
  ADD COLUMN IF NOT EXISTS intervalle_revision_km integer DEFAULT 20000;

CREATE TABLE IF NOT EXISTS public.vehicle_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  effectue_le date NOT NULL DEFAULT CURRENT_DATE,
  kilometrage integer,
  type_intervention text NOT NULL DEFAULT 'entretien',
  cout numeric(12,2),
  garage text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maint_vehicle ON public.vehicle_maintenances(vehicle_id, effectue_le DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenances TO authenticated;
GRANT ALL ON public.vehicle_maintenances TO service_role;

ALTER TABLE public.vehicle_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_maint_members_select" ON public.vehicle_maintenances
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_maintenances.vehicle_id
    AND (public.is_org_member(v.organization_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role))
));

CREATE POLICY "vehicle_maint_admins_manage" ON public.vehicle_maintenances
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_maintenances.vehicle_id
    AND (public.is_org_admin(v.organization_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_maintenances.vehicle_id
    AND (public.is_org_admin(v.organization_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role))
));

CREATE TRIGGER trg_vehicle_maint_updated_at
BEFORE UPDATE ON public.vehicle_maintenances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();