CREATE OR REPLACE FUNCTION public.user_mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN true
    WHEN NOT EXISTS (SELECT 1 FROM public.user_mfa_settings s WHERE s.user_id = auth.uid() AND s.enabled AND s.phone IS NOT NULL) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_mfa_sessions m
      JOIN public.user_mfa_settings s ON s.user_id = m.user_id
      WHERE m.user_id = auth.uid()
        AND m.session_id = coalesce(auth.jwt() ->> 'session_id', '')
        AND m.expires_at > now()
        AND m.verified_at >= s.updated_at
    )
  END
$$;
REVOKE ALL ON FUNCTION public.user_mfa_satisfied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_mfa_satisfied() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['missions','devis','devis_lots','devis_lignes','factures','vehicles','vehicle_documents','client_default_addresses','inspection_photos']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.user_mfa_satisfied())) WITH CHECK ((SELECT public.user_mfa_satisfied()))', t || '_require_user_mfa', t);
  END LOOP;
END $$;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS derniere_revision_le date,
  ADD COLUMN IF NOT EXISTS derniere_revision_km integer,
  ADD COLUMN IF NOT EXISTS intervalle_revision_mois integer,
  ADD COLUMN IF NOT EXISTS km_moyen_mois integer,
  ADD COLUMN IF NOT EXISTS pneumatiques text,
  ADD COLUMN IF NOT EXISTS assureur text,
  ADD COLUMN IF NOT EXISTS assurance_numero_contrat text,
  ADD COLUMN IF NOT EXISTS mode_detention text,
  ADD COLUMN IF NOT EXISTS fin_contrat_le date,
  ADD COLUMN IF NOT EXISTS loyer_mensuel numeric,
  ADD COLUMN IF NOT EXISTS km_contrat integer,
  ADD COLUMN IF NOT EXISTS entretien_cout_annuel numeric,
  ADD COLUMN IF NOT EXISTS automatismes jsonb NOT NULL DEFAULT '{}'::jsonb;