DROP POLICY IF EXISTS "super_admin can read audit" ON public.admin_security_audit;
CREATE POLICY "super_admin can read audit" ON public.admin_security_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Client insert own acceptation" ON public.devis_acceptations;
CREATE POLICY "Client insert own acceptation" ON public.devis_acceptations
  FOR INSERT TO authenticated
  WITH CHECK (
    ((client_user_id = auth.uid())
      OR ((auth_verified_email() IS NOT NULL) AND (lower(client_email) = auth_verified_email())))
    AND EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.id = devis_acceptations.devis_id
        AND (d.user_id = auth.uid()
             OR ((auth_verified_email() IS NOT NULL) AND lower(COALESCE(d.email, '')) = auth_verified_email()))
    )
  );

DROP POLICY IF EXISTS "Client read own acceptations" ON public.devis_acceptations;
CREATE POLICY "Client read own acceptations" ON public.devis_acceptations
  FOR SELECT TO authenticated
  USING (
    (client_user_id = auth.uid())
    OR ((auth_verified_email() IS NOT NULL) AND (lower(client_email) = auth_verified_email()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "loyalty_settings_read_auth" ON public.loyalty_settings;
CREATE POLICY "loyalty_settings_read_auth" ON public.loyalty_settings
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'client'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.loyalty_accounts la WHERE la.client_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients read missions by email" ON public.missions;
CREATE POLICY "Clients read missions by email" ON public.missions
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id)
    OR ((auth_verified_email() IS NOT NULL) AND (lower(email) = auth_verified_email()))
  );

COMMENT ON COLUMN public.trajets.prix_convoyeur IS 'INTERNE - marge : ne jamais exposer via une policy client/convoyeur';
COMMENT ON COLUMN public.trajets.prix_societe IS 'INTERNE - marge : ne jamais exposer via une policy client/convoyeur';
COMMENT ON COLUMN public.trajets.commission_convoyeur_pct IS 'INTERNE - marge : ne jamais exposer via une policy client/convoyeur';
COMMENT ON COLUMN public.trajets.tarif_convoyeur IS 'INTERNE - marge : ne jamais exposer via une policy client/convoyeur';
COMMENT ON COLUMN public.trajets.prix_convoyeur_fixe IS 'INTERNE - marge : ne jamais exposer via une policy client/convoyeur';

DROP VIEW IF EXISTS public.trajets_safe;
CREATE VIEW public.trajets_safe
WITH (security_invoker = true) AS
SELECT t.id, t.created_at, t.updated_at, t.statut, t.numero_mission, t.mission_group_id,
       t.depart, t.arrivee, t.date_trajet, t.heure_trajet, t.date_souhaitee,
       t.marque, t.modele, t.immatriculation, t.type_mission,
       t.leg_type, t.leg_index, t.lot_id, t.lot_reference, t.group_reference
FROM public.trajets t;

REVOKE ALL ON public.trajets_safe FROM anon;
GRANT SELECT ON public.trajets_safe TO authenticated;
GRANT SELECT ON public.trajets_safe TO service_role;