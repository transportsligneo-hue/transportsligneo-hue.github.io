DROP POLICY IF EXISTS "Convoyeurs delete own mission documents" ON storage.objects;
CREATE POLICY "Admins delete mission documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'mission-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));