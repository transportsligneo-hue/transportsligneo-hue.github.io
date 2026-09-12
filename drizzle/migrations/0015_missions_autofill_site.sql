CREATE OR REPLACE FUNCTION public.missions_fill_site()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_site uuid;
BEGIN
  IF NEW.site_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_org := COALESCE(NEW.fleet_organization_id, NEW.organization_id);
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Site rattaché à l'utilisateur qui crée la mission
  SELECT ms.site_id INTO v_site
  FROM public.organization_member_sites ms
  JOIN public.organization_members m ON m.id = ms.member_id
  JOIN public.organization_sites s ON s.id = ms.site_id
  WHERE m.organization_id = v_org
    AND m.user_id = auth.uid()
    AND s.organization_id = v_org
  LIMIT 1;

  -- 2) Sinon : organisation mono-site
  IF v_site IS NULL THEN
    SELECT s.id INTO v_site
    FROM public.organization_sites s
    WHERE s.organization_id = v_org AND s.actif
    LIMIT 1;
    IF (SELECT count(*) FROM public.organization_sites s2 WHERE s2.organization_id = v_org AND s2.actif) <> 1 THEN
      v_site := NULL;
    END IF;
  END IF;

  NEW.site_id := v_site;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.missions_fill_site() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_missions_fill_site ON public.missions;
CREATE TRIGGER trg_missions_fill_site
BEFORE INSERT ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_fill_site();