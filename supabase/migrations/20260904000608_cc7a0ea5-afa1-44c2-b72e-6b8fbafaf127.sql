REVOKE EXECUTE ON FUNCTION public.fleet_member_role(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fleet_is_global_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fleet_can_view_vehicle(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fleet_can_manage_costs(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_tco(uuid, date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_fleet_tco(uuid, date, date, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_fleet_alerts(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_convoyage_cost(uuid, uuid, uuid) FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.fleet_member_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fleet_is_global_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fleet_can_view_vehicle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fleet_can_manage_costs(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_tco(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleet_tco(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleet_alerts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_convoyage_cost(uuid, uuid, uuid) TO service_role;