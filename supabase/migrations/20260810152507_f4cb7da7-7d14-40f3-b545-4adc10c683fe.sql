
DROP POLICY IF EXISTS "org_logos_public_read" ON storage.objects;
CREATE POLICY "org_logos_authenticated_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'organization-logos');
