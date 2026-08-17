CREATE POLICY "Admins upload devis pdf" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'devis-acceptes' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Admins update devis pdf" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'devis-acceptes' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (bucket_id = 'devis-acceptes' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));