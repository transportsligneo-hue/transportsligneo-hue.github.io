
-- 1. Restrict pricing_settings SELECT to admins; provide RPC for safe display fields
DROP POLICY IF EXISTS "Authenticated users can read pricing settings" ON public.pricing_settings;
CREATE POLICY "Admins can read pricing settings"
  ON public.pricing_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.get_public_pricing_display()
RETURNS TABLE(regime text, default_vat_rate numeric, currency text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT regime, default_vat_rate, currency FROM public.pricing_settings WHERE id = true LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_pricing_display() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_pricing_display() TO authenticated, service_role;

-- 2. Restrict role_permissions SELECT to admins/super_admins
DROP POLICY IF EXISTS "Authenticated read role permissions" ON public.role_permissions;
CREATE POLICY "Admins can read role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3. Revoke anon EXECUTE on SECURITY DEFINER functions that require authenticated context
REVOKE EXECUTE ON FUNCTION public.convoyeurs_protect_privileged_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_client_pricing_split(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_propose_mission_to_convoyeur(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_respond_to_proposal(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_apply_to_mission(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_publish_to_catalogue(uuid, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_proposals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_award_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_counter_offer(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_offer(uuid, text) FROM PUBLIC, anon;
