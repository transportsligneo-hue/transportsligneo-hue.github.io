-- 1. Sites : siège optionnel + SIRET établissement
ALTER TABLE public.organization_sites
  ADD COLUMN IF NOT EXISTS est_siege boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS siret_etablissement text;

-- 2. Organisations : SIRET siège + mode de facturation
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS siret_siege text,
  ADD COLUMN IF NOT EXISTS facturation_mode text NOT NULL DEFAULT 'consolidee';

-- 3. Missions : rattachement optionnel à un site
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_missions_site_id ON public.missions(site_id);

-- 4. Contacts propres à chaque site
CREATE TABLE IF NOT EXISTS public.site_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.organization_sites(id) ON DELETE CASCADE,
  nom text NOT NULL,
  prenom text,
  email text,
  telephone text,
  role text NOT NULL DEFAULT 'principal',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_contacts_site ON public.site_contacts(site_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_contacts TO authenticated;
GRANT ALL ON public.site_contacts TO service_role;
ALTER TABLE public.site_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_contacts_members_select ON public.site_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_sites s
    WHERE s.id = site_contacts.site_id
      AND (public.is_org_member(s.organization_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

CREATE POLICY site_contacts_admins_manage ON public.site_contacts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_sites s
    WHERE s.id = site_contacts.site_id
      AND (public.is_org_admin(s.organization_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_sites s
    WHERE s.id = site_contacts.site_id
      AND (public.is_org_admin(s.organization_id, auth.uid())
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'super_admin'::app_role))
  ));

-- 5. Historique d'audit des transferts entre sites
CREATE TABLE IF NOT EXISTS public.site_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_label text,
  from_site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL,
  to_site_id uuid REFERENCES public.organization_sites(id) ON DELETE SET NULL,
  moved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_transfers_org ON public.site_transfers(organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.site_transfers TO authenticated;
GRANT ALL ON public.site_transfers TO service_role;
ALTER TABLE public.site_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_transfers_members_select ON public.site_transfers
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY site_transfers_admins_insert ON public.site_transfers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid())
              OR public.has_role(auth.uid(), 'admin'::app_role)
              OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 6. Sites accessibles à un utilisateur (évite la récursion RLS)
CREATE OR REPLACE FUNCTION public.user_site_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ms.site_id
  FROM public.organization_member_sites ms
  JOIN public.organization_members m ON m.id = ms.member_id
  WHERE m.user_id = _user_id AND m.status = 'active'
$$;

REVOKE ALL ON FUNCTION public.user_site_ids(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_site_ids(uuid) TO service_role;
