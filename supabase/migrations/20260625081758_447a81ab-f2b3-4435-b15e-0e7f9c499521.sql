CREATE OR REPLACE VIEW public.trajets_publies_safe
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.depart,
  t.arrivee,
  t.date_trajet,
  t.heure_trajet,
  t.marque,
  t.modele,
  t.prix_suggere,
  t.statut_publication,
  t.created_at,
  t.pricing_mode,
  t.prix_convoyeur_fixe,
  t.prix_convoyeur_min,
  t.prix_convoyeur_max,
  t.mission_group_id,
  t.leg_type,
  COALESCE(t.bidding_enabled, false) AS bidding_enabled
FROM public.trajets t
WHERE t.statut_publication = 'publie';

REVOKE ALL ON public.trajets_publies_safe FROM PUBLIC;
GRANT SELECT ON public.trajets_publies_safe TO authenticated;