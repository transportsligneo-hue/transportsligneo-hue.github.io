-- Fail-closed guarantee for internal margin data: a RESTRICTIVE policy applies
-- on top of ANY future permissive policy, so margins can never leak to clients.
DROP POLICY IF EXISTS "Restrict trajets admin data to admins" ON public.trajets_admin_data;
CREATE POLICY "Restrict trajets admin data to admins"
ON public.trajets_admin_data
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- No anonymous access whatsoever to internal pricing/margin data
REVOKE ALL ON public.trajets_admin_data FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trajets_admin_data TO authenticated;
GRANT ALL ON public.trajets_admin_data TO service_role;