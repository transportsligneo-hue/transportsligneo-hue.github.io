CREATE TABLE public.vehicle_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marque text NOT NULL,
  modele text NOT NULL,
  version text,
  energie text,
  categorie text,
  photo_path text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicle_catalog_uniq ON public.vehicle_catalog (lower(marque), lower(modele), coalesce(lower(version), ''));
GRANT SELECT ON public.vehicle_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vehicle_catalog TO authenticated;
GRANT ALL ON public.vehicle_catalog TO service_role;
ALTER TABLE public.vehicle_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog read" ON public.vehicle_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog admin write" ON public.vehicle_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));