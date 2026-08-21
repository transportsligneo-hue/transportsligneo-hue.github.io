CREATE POLICY "Admins manage avatars" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
WITH CHECK (bucket_id = 'avatars' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));