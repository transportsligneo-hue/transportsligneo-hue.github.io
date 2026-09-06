DROP POLICY IF EXISTS "Org admins upload vehicle files" ON storage.objects;
CREATE POLICY "Org admins upload vehicle files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents'
  AND (public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
       OR public.fleet_member_role(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('fleet_admin','fleet_finance')
       OR public.fleet_is_global_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Org admins delete vehicle files" ON storage.objects;
CREATE POLICY "Org admins delete vehicle files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
       OR public.fleet_member_role(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('fleet_admin','fleet_finance')
       OR public.fleet_is_global_admin(auth.uid()))
);