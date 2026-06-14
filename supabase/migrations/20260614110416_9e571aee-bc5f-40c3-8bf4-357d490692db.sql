
REVOKE EXECUTE ON FUNCTION public.is_attribution_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_attribution_client(uuid, uuid) TO authenticated, service_role;
