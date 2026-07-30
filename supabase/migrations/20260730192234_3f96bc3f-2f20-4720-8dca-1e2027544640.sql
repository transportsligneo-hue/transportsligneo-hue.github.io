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
  v_request text;
  v_response text;
  v_request_id bigint;
BEGIN
  SELECT public.has_role(_converted_by, 'admin'::public.app_role)
      OR public.has_role(_converted_by, 'super_admin'::public.app_role)
    INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Accès administrateur requis' USING ERRCODE = '42501';
  END IF;

  SELECT current_setting('request.headers', true) INTO v_request;
  SELECT current_setting('response.headers', true) INTO v_response;
  SELECT NULLIF(current_setting('request.id', true), '')::bigint INTO v_request_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _converted_by::text, 'role', 'authenticated')::text,
    true
  );

  RETURN QUERY
  SELECT c.mission_id, c.leg, c.numero
  FROM public.admin_convert_demande_to_missions(_demande_id) AS c;

  IF v_request IS NOT NULL THEN PERFORM set_config('request.headers', v_request, true); END IF;
  IF v_response IS NOT NULL THEN PERFORM set_config('response.headers', v_response, true); END IF;
  IF v_request_id IS NOT NULL THEN PERFORM set_config('request.id', v_request_id::text, true); END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_convert_demande_to_missions(uuid, uuid) TO service_role;