
-- 1) Colonnes additives sur organizations (nullable / avec défaut) — aucun impact sur l'existant
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'b2b_standard',
  ADD COLUMN IF NOT EXISTS logo_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_account_type_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_account_type_check
      CHECK (account_type IN ('b2b_standard','flotte'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_account_type
  ON public.organizations(account_type);

-- 2) Politiques RLS sur storage.objects pour le bucket `organization-logos`
--    Lecture publique (nécessaire pour l'affichage des logos sur factures + espace client)
--    Ecriture réservée aux admins et aux owners/admins de l'organisation propriétaire.
--    Convention : le fichier est stocké sous `<organization_id>/<filename>` — le 1er segment
--    du chemin est donc l'UUID de l'organisation.

-- Nettoyage idempotent
DROP POLICY IF EXISTS "org_logos_public_read"          ON storage.objects;
DROP POLICY IF EXISTS "org_logos_admin_write"          ON storage.objects;
DROP POLICY IF EXISTS "org_logos_admin_update"         ON storage.objects;
DROP POLICY IF EXISTS "org_logos_admin_delete"         ON storage.objects;
DROP POLICY IF EXISTS "org_logos_owner_write"          ON storage.objects;
DROP POLICY IF EXISTS "org_logos_owner_update"         ON storage.objects;
DROP POLICY IF EXISTS "org_logos_owner_delete"         ON storage.objects;

-- Lecture publique (bucket privé mais lecture ouverte via policy explicite)
CREATE POLICY "org_logos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'organization-logos');

-- Admins / super_admins : plein contrôle
CREATE POLICY "org_logos_admin_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

CREATE POLICY "org_logos_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

CREATE POLICY "org_logos_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

-- Owner / admin de l'organisation (1er segment du chemin = organization_id)
CREATE POLICY "org_logos_owner_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "org_logos_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "org_logos_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_org_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);
