-- 1) Safe, column-filtered view for client-facing reads of trajets
CREATE OR REPLACE VIEW public.trajets_client_safe
WITH (security_invoker = false) AS
SELECT
  t.id, t.demande_id, t.depart, t.arrivee, t.date_trajet, t.heure_trajet, t.marque, t.modele,
  t.immatriculation, t.client_nom, t.client_telephone, t.client_email, t.prix, t.statut,
  t.created_at, t.updated_at, t.statut_publication, t.pricing_mode, t.devis_id, t.prix_client,
  t.published_at, t.vin, t.carte_grise_recto_url, t.carte_grise_verso_url, t.arrivee_contact_nom,
  t.arrivee_contact_telephone, t.arrivee_contact_telephone2, t.arrivee_contact_instructions,
  t.contact_depart_nom, t.contact_depart_tel, t.contact_depart_note, t.contact_arrivee_nom,
  t.contact_arrivee_tel, t.contact_arrivee_note, t.options_meta, t.vehicule_immatriculation,
  t.vehicule_vin, t.vehicule_energie, t.vehicule_type, t.vehicule_couleur, t.vehicule_km,
  t.vehicule_notes, t.type_mission, t.commande_ref, t.parent_trajet_id, t.arrivee_contact_prenom,
  t.arrivee_contact_societe, t.archived_at, t.mission_group_id, t.leg_type, t.leg_index,
  t.bidding_enabled, t.attribution_mode, t.allow_counter_offer, t.proposal_expires_at,
  t.is_test_data, t.mission_id, t.date_souhaitee, t.prix_total, t.group_reference,
  t.is_round_trip, t.numero_mission, t.arrivee_contact_email, t.niveau_requis, t.pv_digitalise
FROM public.trajets t
WHERE
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.trajet_id = t.id
      AND c.user_id = auth.uid()
      AND a.statut = ANY (ARRAY['accepte','en_cours','termine','terminee','validee'])
  )
  OR EXISTS (
    SELECT 1 FROM public.attributions a
    WHERE a.trajet_id = t.id AND public.is_attribution_client(auth.uid(), a.id)
  );

GRANT SELECT ON public.trajets_client_safe TO authenticated;

-- Clients now read through the safe view only (no internal margin columns)
DROP POLICY IF EXISTS "Clients read own trajets" ON public.trajets;

-- 2) Email infrastructure tables: restrict policies explicitly to service_role
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can insert send log" ON public.email_send_log
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read send log" ON public.email_send_log
  FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can update send log" ON public.email_send_log
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens
  FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails
  FOR SELECT TO service_role USING (true);