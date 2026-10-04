CREATE TABLE public.pro_demo_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nom_contact text,
  societe text,
  telephone text,
  token text UNIQUE,
  statut text NOT NULL DEFAULT 'demande_recue',
  expires_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.pro_demo_access TO authenticated;
GRANT ALL ON public.pro_demo_access TO service_role;
ALTER TABLE public.pro_demo_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage demo access" ON public.pro_demo_access FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX pro_demo_access_created_idx ON public.pro_demo_access (created_at DESC);