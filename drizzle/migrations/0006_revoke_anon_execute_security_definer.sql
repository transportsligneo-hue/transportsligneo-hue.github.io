-- Retirer EXECUTE au rôle anon sur les fonctions SECURITY DEFINER qui ne sont pas destinées au public.
-- Liste blanche : fonctions appelées par les pages publiques (formulaires B2B, invitation convoyeur,
-- tarifs publics, vérification de certificat, scan public).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN (
        'create_b2b_transport_request',
        'find_or_create_company',
        'get_convoyeur_invitation',
        'get_public_pricing_display',
        'verify_certificate',
        'create_scan_handoff_session'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;