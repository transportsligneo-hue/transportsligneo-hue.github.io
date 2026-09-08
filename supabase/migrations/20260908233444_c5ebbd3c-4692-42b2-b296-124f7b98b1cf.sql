-- api_keys : restreindre la lecture aux admins d'organisation
DROP POLICY IF EXISTS api_keys_member_select ON public.api_keys;
CREATE POLICY api_keys_admin_select ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    is_org_admin(organization_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- api_webhook_endpoints : idem
DROP POLICY IF EXISTS api_webhooks_member_select ON public.api_webhook_endpoints;
CREATE POLICY api_webhooks_admin_select ON public.api_webhook_endpoints
  FOR SELECT TO authenticated
  USING (
    is_org_admin(organization_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Colonnes sensibles : jamais exposées via l'API Data
REVOKE ALL (key_hash) ON public.api_keys FROM authenticated, anon;
REVOKE ALL (secret) ON public.api_webhook_endpoints FROM authenticated, anon;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.api_webhook_endpoints TO service_role;