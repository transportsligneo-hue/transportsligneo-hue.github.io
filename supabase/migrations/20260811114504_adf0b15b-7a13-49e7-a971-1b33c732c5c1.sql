CREATE TABLE public.po_pdf_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid,
  facture_id uuid,
  facture_numero text,
  action text NOT NULL CHECK (action IN ('po_change','pdf_regenerate')),
  old_po text,
  new_po text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.po_pdf_history TO authenticated;
GRANT ALL ON public.po_pdf_history TO service_role;

ALTER TABLE public.po_pdf_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read po history"
ON public.po_pdf_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert po history"
ON public.po_pdf_history FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND actor_id = auth.uid()
);

CREATE INDEX idx_po_pdf_history_attribution ON public.po_pdf_history (attribution_id, created_at DESC);
CREATE INDEX idx_po_pdf_history_facture ON public.po_pdf_history (facture_id, created_at DESC);