DROP VIEW IF EXISTS public.trajets_publies_safe;
DROP FUNCTION IF EXISTS public._trajets_publies_safe_rows();

CREATE OR REPLACE FUNCTION public._trajets_publies_safe_rows()
 RETURNS TABLE(id uuid, depart text, arrivee text, date_trajet date, heure_trajet text, marque text, modele text, prix_suggere numeric, prix_convoyeur numeric, prix_convoyeur_fixe numeric, prix_convoyeur_min numeric, prix_convoyeur_max numeric, pricing_mode text, attribution_mode text, allow_counter_offer boolean, proposal_expires_at timestamp with time zone, statut_publication text, published_at timestamp with time zone, created_at timestamp with time zone, mission_group_id uuid, leg_type text, bidding_enabled boolean, is_test_data boolean, niveau_requis text, vehicule_energie text, publisher_nom text, publisher_logo_url text, publisher_verifie boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    t.id, t.depart, t.arrivee, t.date_trajet, t.heure_trajet,
    t.marque, t.modele, t.prix_suggere, t.prix_convoyeur,
    t.prix_convoyeur_fixe, t.prix_convoyeur_min, t.prix_convoyeur_max,
    t.pricing_mode, t.attribution_mode, t.allow_counter_offer,
    t.proposal_expires_at, t.statut_publication, t.published_at,
    t.created_at, t.mission_group_id, t.leg_type,
    COALESCE(t.bidding_enabled, false),
    COALESCE(t.is_test_data, false),
    COALESCE(t.niveau_requis, 'debutant'),
    t.vehicule_energie,
    COALESCE(o.commercial_name, o.legal_name, p.societe, t.client_nom)::text AS publisher_nom,
    COALESCE(o.logo_url, p.logo_url)::text AS publisher_logo_url,
    (o.id IS NOT NULL) AS publisher_verifie
  FROM public.trajets t
  LEFT JOIN LATERAL (
    SELECT d.user_id FROM public.demandes_convoyage d WHERE d.id = t.demande_id
    UNION ALL
    SELECT dv.user_id FROM public.devis dv WHERE dv.id = t.devis_id
    LIMIT 1
  ) src ON true
  LEFT JOIN public.profiles p ON p.id = src.user_id
  LEFT JOIN LATERAL (
    SELECT org.id, org.commercial_name, org.legal_name, org.logo_url
    FROM public.organization_members m
    JOIN public.organizations org ON org.id = m.organization_id
    WHERE m.user_id = src.user_id
    LIMIT 1
  ) o ON true
  WHERE t.statut_publication = 'publie'
    AND t.attribution_mode IN ('catalogue', 'mixte')
    AND (t.proposal_expires_at IS NULL OR t.proposal_expires_at > now())
    AND public.is_validated_convoyeur(auth.uid());
$function$;

CREATE VIEW public.trajets_publies_safe AS
  SELECT * FROM public._trajets_publies_safe_rows();

GRANT SELECT ON public.trajets_publies_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public._trajets_publies_safe_rows() TO authenticated;