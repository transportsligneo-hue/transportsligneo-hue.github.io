CREATE POLICY outils_logos_admin_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'outils-externes-logos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'outils-externes-logos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY outils_logos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'outils-externes-logos');