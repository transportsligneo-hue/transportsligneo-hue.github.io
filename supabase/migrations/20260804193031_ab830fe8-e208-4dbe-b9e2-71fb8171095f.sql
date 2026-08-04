CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'autre',
  nom text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  taille_octets bigint,
  expire_le date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_documents_vehicle ON public.vehicle_documents(vehicle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read vehicle documents"
ON public.vehicle_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_documents.vehicle_id
    AND public.is_org_member(v.organization_id, auth.uid())
));

CREATE POLICY "Org admins manage vehicle documents"
ON public.vehicle_documents FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_documents.vehicle_id
    AND public.is_org_admin(v.organization_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.id = vehicle_documents.vehicle_id
    AND public.is_org_admin(v.organization_id, auth.uid())
));

CREATE TRIGGER trg_vehicle_documents_updated_at
BEFORE UPDATE ON public.vehicle_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();