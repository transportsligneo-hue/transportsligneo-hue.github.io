-- Étendre les policies storage admin au rôle super_admin
DROP POLICY IF EXISTS "Admins can access all mission documents" ON storage.objects;
CREATE POLICY "Admins can access all mission documents"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'mission-documents' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'mission-documents' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins can view all convoyeur documents" ON storage.objects;
CREATE POLICY "Admins can view all convoyeur documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'convoyeur-documents' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins can view all inspection photos" ON storage.objects;
CREATE POLICY "Admins can view all inspection photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inspection-photos' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage all permis" ON storage.objects;
CREATE POLICY "Admins manage all permis"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'convoyeur-permis' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'convoyeur-permis' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins read all selfies" ON storage.objects;
CREATE POLICY "Admins read all selfies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mission-selfies' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
