DROP POLICY IF EXISTS "Convoyeurs update own mission selfies" ON storage.objects;
DROP POLICY IF EXISTS "Convoyeurs delete own mission selfies" ON storage.objects;

CREATE POLICY "Convoyeurs update own mission selfies"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mission-selfies'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.mission_selfies ms
    WHERE ms.storage_path = storage.objects.name
      AND ms.convoyeur_user_id = auth.uid()
  )
);

CREATE POLICY "Convoyeurs delete own mission selfies"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mission-selfies'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.mission_selfies ms
    WHERE ms.storage_path = storage.objects.name
      AND ms.convoyeur_user_id = auth.uid()
  )
);