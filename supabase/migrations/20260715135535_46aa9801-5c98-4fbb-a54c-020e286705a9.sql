
DROP POLICY IF EXISTS "Validated convoyeurs can read published catalogue trajets" ON public.trajets;

DROP VIEW IF EXISTS public.trajets_publies_safe;
CREATE VIEW public.trajets_publies_safe
WITH (security_invoker=false) AS
SELECT
  t.id,
  t.depart,
  t.arrivee,
  t.date_trajet,
  t.heure_trajet,
  t.marque,
  t.modele,
  t.prix_suggere,
  t.prix_convoyeur,
  t.prix_convoyeur_fixe,
  t.prix_convoyeur_min,
  t.prix_convoyeur_max,
  t.pricing_mode,
  t.attribution_mode,
  t.allow_counter_offer,
  t.proposal_expires_at,
  t.statut_publication,
  t.published_at,
  t.created_at,
  t.mission_group_id,
  t.leg_type,
  COALESCE(t.bidding_enabled, false) AS bidding_enabled
FROM public.trajets t
WHERE t.statut_publication = 'publie'
  AND t.attribution_mode = ANY (ARRAY['catalogue','mixte'])
  AND (t.proposal_expires_at IS NULL OR t.proposal_expires_at > now())
  AND public.is_validated_convoyeur(auth.uid());

GRANT SELECT ON public.trajets_publies_safe TO authenticated;

DROP POLICY IF EXISTS "Public verify certificate" ON public.formation_certificates;

CREATE OR REPLACE FUNCTION public.verify_certificate(_token uuid)
RETURNS TABLE(certificate_number text, full_name text, issued_at timestamptz, valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.certificate_number,
         c.full_name,
         c.issued_at,
         (c.revoked_at IS NULL) AS valid
  FROM public.formation_certificates c
  WHERE c.verification_token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_training_status_after_progress() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_exam_attempt() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_convoyeur_training_status(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_completed_driver_training(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_completed_driver_training(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_convoyeur_training_status(uuid) TO authenticated, service_role;
