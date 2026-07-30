CREATE OR REPLACE FUNCTION public.service_convert_demande_to_missions(
  _demande_id uuid,
  _converted_by uuid
)
RETURNS TABLE(mission_id uuid, leg text, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_original_claims text := current_setting('request.jwt.claims', true);
BEGIN
  SELECT public.has_role(_converted_by, 'admin'::public.app_role)
      OR public.has_role(_converted_by, 'super_admin'::public.app_role)
    INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Accès administrateur requis' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _converted_by::text, 'role', 'authenticated')::text,
    true
  );

  RETURN QUERY
  SELECT c.mission_id, c.leg, c.numero
  FROM public.admin_convert_demande_to_missions(_demande_id) AS c;

  PERFORM set_config('request.jwt.claims', COALESCE(v_original_claims, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) TO service_role;