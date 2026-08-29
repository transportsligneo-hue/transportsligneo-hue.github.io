CREATE POLICY "Clients delete own personal vehicle docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'mes-documents'
);