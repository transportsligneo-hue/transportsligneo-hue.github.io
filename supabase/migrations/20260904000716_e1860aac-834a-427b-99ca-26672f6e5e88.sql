CREATE POLICY "vehicle_costs_files_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-costs'
  AND (public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
       OR public.fleet_is_global_admin(auth.uid()))
);

CREATE POLICY "vehicle_costs_files_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-costs'
  AND (public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
       OR public.fleet_member_role(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('fleet_admin','fleet_finance')
       OR public.fleet_is_global_admin(auth.uid()))
);

CREATE POLICY "vehicle_costs_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-costs'
  AND (public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
       OR public.fleet_member_role(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('fleet_admin','fleet_finance')
       OR public.fleet_is_global_admin(auth.uid()))
);