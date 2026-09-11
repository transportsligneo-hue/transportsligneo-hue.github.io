-- EXECUTE est accordé par défaut à PUBLIC : le révoquer sur les fonctions SECURITY DEFINER non publiques,
-- puis le rendre explicitement aux utilisateurs connectés (comportement actuel préservé).
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;