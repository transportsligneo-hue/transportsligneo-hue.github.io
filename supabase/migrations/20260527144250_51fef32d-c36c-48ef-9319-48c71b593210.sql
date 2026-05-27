-- 1) Stop broadcasting client PII via Realtime on trajets
ALTER PUBLICATION supabase_realtime DROP TABLE public.trajets;

-- 2) Tighten convoyeur-documents INSERT policy to require an active convoyeur record
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'INSERT'
      AND qual IS NULL
      AND with_check ILIKE '%convoyeur-documents%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Convoyeurs upload own convoyeur-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'convoyeur-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.convoyeurs c WHERE c.user_id = auth.uid()
  )
);