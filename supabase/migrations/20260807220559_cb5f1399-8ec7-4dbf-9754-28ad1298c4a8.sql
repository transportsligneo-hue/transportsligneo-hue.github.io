CREATE POLICY "Admins read contrats convoyeurs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contrats-convoyeurs'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Admins manage contrats convoyeurs"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'contrats-convoyeurs'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  bucket_id = 'contrats-convoyeurs'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);