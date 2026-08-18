
-- 1) companies: allow the contact who created the lead to read their own row (fail-closed otherwise)
DROP POLICY IF EXISTS "Contacts read own company lead" ON public.companies;
CREATE POLICY "Contacts read own company lead"
ON public.companies FOR SELECT TO authenticated
USING (lower(btrim(contact_email)) = lower(btrim(COALESCE(auth.jwt() ->> 'email', ''))) AND COALESCE(auth.jwt() ->> 'email', '') <> '');

-- 2) missions: lock sensitive columns against client updates (allow-list approach)
CREATE OR REPLACE FUNCTION public.missions_lock_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service_role / internal jobs
  END IF;

  NEW.id := OLD.id;
  NEW.numero := OLD.numero;
  NEW.user_id := OLD.user_id;
  NEW.email := OLD.email;
  NEW.prix_total := OLD.prix_total;
  NEW.statut := OLD.statut;
  NEW.organization_id := OLD.organization_id;
  NEW.fleet_organization_id := OLD.fleet_organization_id;
  NEW.immatriculation := OLD.immatriculation;
  NEW.vin := OLD.vin;
  NEW.marque := OLD.marque;
  NEW.modele := OLD.modele;
  NEW.carburant := OLD.carburant;
  NEW.mission_group_id := OLD.mission_group_id;
  NEW.leg_type := OLD.leg_type;
  NEW.leg_index := OLD.leg_index;
  NEW.group_reference := OLD.group_reference;
  NEW.prix_locked := OLD.prix_locked;
  NEW.devis_id := OLD.devis_id;
  NEW.tracking_code := OLD.tracking_code;
  NEW.created_at := OLD.created_at;
  NEW.archived_at := OLD.archived_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missions_lock_sensitive_fields ON public.missions;
CREATE TRIGGER trg_missions_lock_sensitive_fields
BEFORE UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_lock_sensitive_fields();

-- 3) storage: scope organization-logos reads to org members / admins
DROP POLICY IF EXISTS "org_logos_authenticated_read" ON storage.objects;
CREATE POLICY "org_logos_member_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
);

-- 4) realtime: stop broadcasting internal AI settings
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_settings;
