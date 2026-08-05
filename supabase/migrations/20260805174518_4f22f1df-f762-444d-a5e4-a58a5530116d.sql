CREATE OR REPLACE FUNCTION public.api_rate_bump(_api_key_id uuid, _window timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.api_rate_counters (api_key_id, window_start, count)
  VALUES (_api_key_id, _window, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET count = public.api_rate_counters.count + 1
  RETURNING count INTO v_count;

  DELETE FROM public.api_rate_counters
  WHERE window_start < now() - interval '1 hour';

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.api_rate_bump(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_bump(uuid, timestamptz) TO service_role;