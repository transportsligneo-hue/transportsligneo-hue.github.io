
-- Move sensitive internal columns out of tables exposed to non-admin readers.

-- 1) b2b_transport_requests.internal_notes -> b2b_transport_requests_admin_data
CREATE TABLE public.b2b_transport_requests_admin_data (
  request_id uuid PRIMARY KEY REFERENCES public.b2b_transport_requests(id) ON DELETE CASCADE,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_transport_requests_admin_data TO authenticated;
GRANT ALL ON public.b2b_transport_requests_admin_data TO service_role;
ALTER TABLE public.b2b_transport_requests_admin_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage b2b request admin data"
  ON public.b2b_transport_requests_admin_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER b2b_request_admin_data_updated_at
  BEFORE UPDATE ON public.b2b_transport_requests_admin_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.b2b_transport_requests_admin_data (request_id, internal_notes)
SELECT id, internal_notes
FROM public.b2b_transport_requests
WHERE internal_notes IS NOT NULL;

ALTER TABLE public.b2b_transport_requests DROP COLUMN internal_notes;

-- 2) organizations.notes_internes -> organizations_admin_data
CREATE TABLE public.organizations_admin_data (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  notes_internes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations_admin_data TO authenticated;
GRANT ALL ON public.organizations_admin_data TO service_role;
ALTER TABLE public.organizations_admin_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage organizations admin data"
  ON public.organizations_admin_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER organizations_admin_data_updated_at
  BEFORE UPDATE ON public.organizations_admin_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.organizations_admin_data (organization_id, notes_internes)
SELECT id, notes_internes
FROM public.organizations
WHERE notes_internes IS NOT NULL;

ALTER TABLE public.organizations DROP COLUMN notes_internes;

-- 3) Revoke EXECUTE on SECURITY DEFINER trigger functions from anon/authenticated/public.
--    These are trigger-only helpers and must never be callable directly.
REVOKE EXECUTE ON FUNCTION public.demandes_protect_payment_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.demandes_protect_payment_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.demandes_protect_payment_fields() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.missions_protect_operational_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.missions_protect_operational_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.missions_protect_operational_fields() FROM authenticated;
