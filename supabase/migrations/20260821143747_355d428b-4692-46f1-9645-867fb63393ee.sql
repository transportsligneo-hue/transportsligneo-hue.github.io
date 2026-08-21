CREATE POLICY "Convoyeurs upload attribution photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Convoyeurs read attribution photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Convoyeurs update attribution photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Convoyeurs delete attribution photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[2]
  )
);