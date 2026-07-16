
CREATE OR REPLACE VIEW public.trajets_publies_safe
WITH (security_invoker = on) AS
SELECT id, depart, arrivee, date_trajet, heure_trajet, marque, modele,
       prix_suggere, prix_convoyeur, prix_convoyeur_fixe, prix_convoyeur_min, prix_convoyeur_max,
       pricing_mode, attribution_mode, allow_counter_offer, proposal_expires_at,
       statut_publication, published_at, created_at, mission_group_id, leg_type,
       COALESCE(bidding_enabled, false) AS bidding_enabled,
       COALESCE(is_test_data, false) AS is_test_data
FROM public.trajets t
WHERE statut_publication = 'publie'
  AND attribution_mode = ANY (ARRAY['catalogue'::text, 'mixte'::text])
  AND (proposal_expires_at IS NULL OR proposal_expires_at > now())
  AND public.is_validated_convoyeur(auth.uid());

GRANT SELECT ON public.trajets_publies_safe TO authenticated;

DROP POLICY IF EXISTS "Validated convoyeurs read catalogue trajets" ON public.trajets;
CREATE POLICY "Validated convoyeurs read catalogue trajets"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND attribution_mode = ANY (ARRAY['catalogue'::text, 'mixte'::text])
  AND (proposal_expires_at IS NULL OR proposal_expires_at > now())
  AND public.is_validated_convoyeur(auth.uid())
);
