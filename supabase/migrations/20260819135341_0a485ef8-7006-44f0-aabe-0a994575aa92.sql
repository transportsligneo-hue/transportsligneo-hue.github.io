
-- 1) Block self-assignment of organization_id on profile INSERT
CREATE OR REPLACE FUNCTION public.profiles_protect_org_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NOT NULL
     AND NOT public.is_org_member(auth.uid(), NEW.organization_id) THEN
    NEW.organization_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_org_on_insert_trg ON public.profiles;
CREATE TRIGGER profiles_protect_org_on_insert_trg
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_org_on_insert();

-- 2) Missions INSERT must reference an organization the user belongs to
DROP POLICY IF EXISTS "Users can create own missions" ON public.missions;
CREATE POLICY "Users can create own missions"
ON public.missions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id))
  AND (fleet_organization_id IS NULL OR public.is_org_member(auth.uid(), fleet_organization_id))
);
