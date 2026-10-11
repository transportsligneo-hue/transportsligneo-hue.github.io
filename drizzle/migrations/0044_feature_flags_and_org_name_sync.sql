CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT INSERT, UPDATE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_read ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY feature_flags_admin_insert ON public.feature_flags FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY feature_flags_admin_update ON public.feature_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.feature_flags(key, enabled) VALUES ('compte_kilometres', true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_profile_societe_to_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL AND NULLIF(btrim(NEW.societe),'') IS NOT NULL
     AND NEW.societe IS DISTINCT FROM OLD.societe THEN
    UPDATE public.organizations SET commercial_name = btrim(NEW.societe)
    WHERE id = NEW.organization_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_societe_to_org() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_profiles_sync_societe AFTER UPDATE OF societe ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_societe_to_org();

UPDATE public.organizations o SET commercial_name = btrim(p.societe)
FROM public.profiles p
WHERE p.organization_id = o.id AND NULLIF(btrim(p.societe),'') IS NOT NULL
  AND o.commercial_name IS NULL AND o.legal_name IS DISTINCT FROM p.societe;