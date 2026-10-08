DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.proname IN (
      'admin_convert_devis_to_missions','api_emit_event','api_rate_bump','archive_missions_60d',
      'auto_archive_old_records','backfill_missions_from_trajets','detect_mission_alerts',
      'expire_stale_proposals','loyalty_close_due_periods','loyalty_expire_avoirs',
      'normalize_all_mission_numeros','normalize_mission_group_prices','recalculate_company_score',
      'recompute_convoyeur_niveau','refresh_client_km_accounts','refresh_convoyeur_training_status',
      'remu_refresh_totals','sync_convoyage_cost','sync_grouped_devis_trajets','sync_missions_from_devis',
      'sync_trajet_dates_from_devis','sync_trajet_prix_from_devis','loyalty_get_or_create_account')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;