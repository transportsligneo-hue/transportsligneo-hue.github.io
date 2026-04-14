
-- Create mission_documents table
CREATE TABLE public.mission_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribution_id UUID NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  type_document TEXT NOT NULL DEFAULT 'autre',
  nom_fichier TEXT NOT NULL,
  url_fichier TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_documents ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage all mission documents"
ON public.mission_documents FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Convoyeurs can see documents for their missions
CREATE POLICY "Convoyeurs can read own mission documents"
ON public.mission_documents FOR SELECT
TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM attributions a
  JOIN convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

-- Convoyeurs can add documents to their missions
CREATE POLICY "Convoyeurs can insert own mission documents"
ON public.mission_documents FOR INSERT
TO authenticated
WITH CHECK (attribution_id IN (
  SELECT a.id FROM attributions a
  JOIN convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
) AND uploaded_by = auth.uid());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-documents', 'mission-documents', false);

-- Storage policies
CREATE POLICY "Admins can access all mission documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'mission-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs can upload to own missions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mission-documents' AND (storage.foldername(name))[1] IN (
  SELECT a.id::text FROM attributions a
  JOIN convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Convoyeurs can read own mission files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mission-documents' AND (storage.foldername(name))[1] IN (
  SELECT a.id::text FROM attributions a
  JOIN convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));
