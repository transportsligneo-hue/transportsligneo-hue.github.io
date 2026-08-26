CREATE OR REPLACE FUNCTION public.mission_numero_base(_numero text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _numero IS NULL OR btrim(_numero) = '' THEN NULL
    ELSE btrim(regexp_replace(btrim(_numero), '\s*[-–]?\s*(L|R|A)$', '', 'i'))
  END
$$;

REVOKE ALL ON FUNCTION public.mission_numero_base(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.mission_leg_suffix(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sync_attribution_numero_from_trajet() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.attribution_inherit_numero() FROM anon, authenticated, public;