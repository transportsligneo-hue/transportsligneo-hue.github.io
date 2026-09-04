CREATE TABLE public.document_scan_logs (
  id uuid primary key default gen_random_uuid(),
  mission_document_id uuid REFERENCES public.mission_documents(id) ON DELETE SET NULL,
  attribution_id uuid REFERENCES public.attributions(id) ON DELETE SET NULL,
  numero_mission text,
  type_document text NOT NULL,
  type_libre text,
  scanned_by uuid NOT NULL,
  classement text NOT NULL DEFAULT 'manuel',
  confiance numeric,
  ocr_numero text,
  ocr_client text,
  ocr_plaque text,
  ocr_date text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_scan_logs TO authenticated;
GRANT ALL ON public.document_scan_logs TO service_role;

ALTER TABLE public.document_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage document scan logs"
ON public.document_scan_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_document_scan_logs_attribution ON public.document_scan_logs(attribution_id);
CREATE INDEX idx_document_scan_logs_created ON public.document_scan_logs(created_at DESC);