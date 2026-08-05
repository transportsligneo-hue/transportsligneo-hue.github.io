CREATE POLICY "incident_photos_driver_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'incident-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "incident_photos_driver_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'incident-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "incident_photos_driver_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'incident-photos' AND (storage.foldername(name))[1] = auth.uid()::text);