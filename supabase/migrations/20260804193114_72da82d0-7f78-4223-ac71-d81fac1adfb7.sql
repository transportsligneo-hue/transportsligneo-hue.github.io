CREATE POLICY "Org members read vehicle files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Org admins upload vehicle files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents'
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Org admins delete vehicle files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);