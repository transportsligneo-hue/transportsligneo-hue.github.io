ALTER TABLE public.convoyeurs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.fleet_driver_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL,
  email text NOT NULL,
  prenom text NOT NULL,
  nom text NOT NULL,
  telephone text,
  permis_numero text,
  permis_date_obtention date,
  permis_doc_url text,
  method text NOT NULL DEFAULT 'invitation',
  status text NOT NULL DEFAULT 'invitee',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_driver_invitations_org ON public.fleet_driver_invitations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_driver_invitations TO authenticated;
GRANT ALL ON public.fleet_driver_invitations TO service_role;

ALTER TABLE public.fleet_driver_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read fleet driver invitations"
ON public.fleet_driver_invitations FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org members create fleet driver invitations"
ON public.fleet_driver_invitations FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org members update fleet driver invitations"
ON public.fleet_driver_invitations FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "org members delete fleet driver invitations"
ON public.fleet_driver_invitations FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));