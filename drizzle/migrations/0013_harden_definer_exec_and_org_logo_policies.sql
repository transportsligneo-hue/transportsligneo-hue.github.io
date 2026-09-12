-- 1) Trigger-only SECURITY DEFINER function must not be callable via the API
REVOKE ALL ON FUNCTION public.missions_fill_heure() FROM anon, authenticated, public;

-- 2) Fail-closed folder resolution for organization logo storage paths
CREATE OR REPLACE FUNCTION public.storage_folder_uuid(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _name IS NULL THEN NULL
    WHEN split_part(_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(_name, '/', 1)::uuid
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.storage_folder_uuid(text) FROM public;
GRANT EXECUTE ON FUNCTION public.storage_folder_uuid(text) TO authenticated, service_role;

DROP POLICY IF EXISTS org_logos_member_read ON storage.objects;
DROP POLICY IF EXISTS org_logos_owner_write ON storage.objects;
DROP POLICY IF EXISTS org_logos_owner_update ON storage.objects;
DROP POLICY IF EXISTS org_logos_owner_delete ON storage.objects;

CREATE POLICY org_logos_member_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      public.storage_folder_uuid(name) IS NOT NULL
      AND is_org_member(public.storage_folder_uuid(name), auth.uid())
    )
  )
);

CREATE POLICY org_logos_owner_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND public.storage_folder_uuid(name) IS NOT NULL
  AND is_org_admin(public.storage_folder_uuid(name), auth.uid())
);

CREATE POLICY org_logos_owner_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND public.storage_folder_uuid(name) IS NOT NULL
  AND is_org_admin(public.storage_folder_uuid(name), auth.uid())
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND public.storage_folder_uuid(name) IS NOT NULL
  AND is_org_admin(public.storage_folder_uuid(name), auth.uid())
);

CREATE POLICY org_logos_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND public.storage_folder_uuid(name) IS NOT NULL
  AND is_org_admin(public.storage_folder_uuid(name), auth.uid())
);