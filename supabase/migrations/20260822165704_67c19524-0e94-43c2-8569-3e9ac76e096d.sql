
REVOKE ALL ON FUNCTION public.loyalty_get_or_create_account(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_close_due_periods() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_expire_avoirs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_accrue_mission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_rate_for_km(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.loyalty_apply_avoir(numeric, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_loyalty_adjust(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_rate_for_km(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_apply_avoir(numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_adjust(uuid, numeric, numeric, text) TO authenticated;
