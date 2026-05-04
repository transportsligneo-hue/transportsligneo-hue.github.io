-- Table de persistance des résultats OCR pour documents EDL (PV, carte grise, etc.)
CREATE TABLE public.inspection_document_ocr (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL,
  attribution_id UUID NOT NULL,
  vue_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'admin',
  storage_path TEXT NOT NULL,
  raw_text TEXT,
  structured_data JSONB,
  ocr_status TEXT NOT NULL DEFAULT 'pending',
  ocr_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, vue_type)
);

CREATE INDEX idx_doc_ocr_attribution ON public.inspection_document_ocr(attribution_id);
CREATE INDEX idx_doc_ocr_classification ON public.inspection_document_ocr(classification);

ALTER TABLE public.inspection_document_ocr ENABLE ROW LEVEL SECURITY;

-- Admins gèrent tout
CREATE POLICY "Admins manage doc ocr"
ON public.inspection_document_ocr
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Convoyeurs lisent OCR de leurs missions
CREATE POLICY "Convoyeurs read own doc ocr"
ON public.inspection_document_ocr
FOR SELECT TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

-- Service role insère (depuis edge function)
CREATE POLICY "Service role inserts doc ocr"
ON public.inspection_document_ocr
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role updates doc ocr"
ON public.inspection_document_ocr
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_doc_ocr_updated_at
BEFORE UPDATE ON public.inspection_document_ocr
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();