
-- 1) Catalogue PII: stop exposing full trajets rows to any validated convoyeur.
--    The sanitized view `trajets_publies_safe` is switched to security_invoker=off
--    so it can keep serving safe columns after we drop the permissive base policy.
ALTER VIEW public.trajets_publies_safe SET (security_invoker = off);
GRANT SELECT ON public.trajets_publies_safe TO authenticated;

DROP POLICY IF EXISTS "Validated convoyeurs read catalogue trajets" ON public.trajets;

-- 2) SECURITY DEFINER functions callable by anon that are trigger-only or
--    admin-only. Revoke public EXECUTE.
REVOKE EXECUTE ON FUNCTION public.guard_sensitive_role_changes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_convoyeur_incident_field_tampering() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_self_super_admin_removal() FROM anon, authenticated, public;
