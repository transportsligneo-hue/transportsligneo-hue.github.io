
-- Add type_convoyeur to convoyeurs
ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS type_convoyeur text NOT NULL DEFAULT 'salarie';

-- Add tarif_convoyeur to trajets
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS tarif_convoyeur numeric DEFAULT NULL;

-- Add unique constraint for inspection_photos upsert
ALTER TABLE public.inspection_photos
  ADD CONSTRAINT inspection_photos_inspection_vue_unique
  UNIQUE (inspection_id, vue_type);

-- Storage: allow convoyeurs to UPDATE their own inspection photos (for retake/upsert)
CREATE POLICY "Convoyeurs can update own inspection photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inspection-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Storage: allow convoyeurs to UPDATE their own documents
CREATE POLICY "Convoyeurs can update own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'convoyeur-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Storage: allow convoyeurs to DELETE their own documents
CREATE POLICY "Convoyeurs can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'convoyeur-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);
