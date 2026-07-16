
REVOKE EXECUTE ON FUNCTION public.admin_cancel_mission_leg(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_convert_demande_to_missions(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_mission_prix(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_unlink_mission_from_group(uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_cancel_mission_leg(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_convert_demande_to_missions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_mission_prix(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unlink_mission_from_group(uuid) TO authenticated, service_role;

ALTER FUNCTION public.split_ar_prices(numeric) SET search_path = public, pg_temp;
