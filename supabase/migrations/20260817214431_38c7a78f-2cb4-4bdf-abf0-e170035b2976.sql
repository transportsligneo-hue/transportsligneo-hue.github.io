-- 1. Vue trajets_assigned_safe : retirer les colonnes de marge interne
DROP VIEW IF EXISTS public.trajets_assigned_safe;
DROP FUNCTION IF EXISTS public._trajets_assigned_safe_rows();

CREATE FUNCTION public._trajets_assigned_safe_rows()
RETURNS TABLE(
  id uuid, demande_id uuid, devis_id uuid, depart text, arrivee text,
  date_trajet date, heure_trajet text, marque text, modele text, immatriculation text,
  contact_depart_nom text, contact_depart_tel text, contact_depart_note text,
  contact_arrivee_nom text, contact_arrivee_tel text, contact_arrivee_note text,
  arrivee_contact_nom text, arrivee_contact_telephone text, arrivee_contact_telephone2 text,
  arrivee_contact_instructions text, vin text,
  carte_grise_recto_url text, carte_grise_verso_url text,
  vehicule_immatriculation text, vehicule_vin text, vehicule_energie text, vehicule_type text,
  vehicule_couleur text, vehicule_km integer, vehicule_notes text,
  tarif_convoyeur numeric, prix_suggere numeric, prix_convoyeur_fixe numeric,
  statut text, statut_publication text, published_at timestamp with time zone,
  options_meta jsonb, numero_mission text, mission_group_id uuid, leg_type text,
  type_mission text, pv_digitalise text, date_souhaitee date,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    t.id, t.demande_id, t.devis_id, t.depart, t.arrivee,
    t.date_trajet, t.heure_trajet, t.marque, t.modele, t.immatriculation,
    t.contact_depart_nom, t.contact_depart_tel, t.contact_depart_note,
    t.contact_arrivee_nom, t.contact_arrivee_tel, t.contact_arrivee_note,
    t.arrivee_contact_nom, t.arrivee_contact_telephone, t.arrivee_contact_telephone2,
    t.arrivee_contact_instructions, t.vin,
    t.carte_grise_recto_url, t.carte_grise_verso_url,
    t.vehicule_immatriculation, t.vehicule_vin, t.vehicule_energie, t.vehicule_type,
    t.vehicule_couleur, t.vehicule_km, t.vehicule_notes,
    t.tarif_convoyeur, t.prix_suggere, t.prix_convoyeur_fixe,
    t.statut, t.statut_publication, t.published_at, t.options_meta,
    t.numero_mission, t.mission_group_id, t.leg_type, t.type_mission,
    t.pv_digitalise, t.date_souhaitee, t.created_at, t.updated_at
  FROM public.trajets t
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE a.trajet_id = t.id AND c.user_id = auth.uid()
    );
$function$;

REVOKE ALL ON FUNCTION public._trajets_assigned_safe_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._trajets_assigned_safe_rows() TO authenticated;

CREATE VIEW public.trajets_assigned_safe WITH (security_invoker = on) AS
  SELECT * FROM public._trajets_assigned_safe_rows();
GRANT SELECT ON public.trajets_assigned_safe TO authenticated;

-- 2. Les convoyeurs n'ont plus d'accès direct à la table trajets (colonnes de marge)
DROP POLICY IF EXISTS "Convoyeurs read assigned trajets" ON public.trajets;

-- 3. trajets_client_safe : fonction SECURITY DEFINER + vue security_invoker
DROP VIEW IF EXISTS public.trajets_client_safe;

CREATE FUNCTION public._trajets_client_safe_rows()
RETURNS TABLE(
  id uuid, demande_id uuid, depart text, arrivee text, date_trajet date, heure_trajet text,
  marque text, modele text, immatriculation text, client_nom text, client_telephone text,
  client_email text, prix numeric, statut text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  statut_publication text, pricing_mode text, devis_id uuid, prix_client numeric,
  published_at timestamp with time zone, vin text,
  carte_grise_recto_url text, carte_grise_verso_url text,
  arrivee_contact_nom text, arrivee_contact_telephone text, arrivee_contact_telephone2 text,
  arrivee_contact_instructions text, contact_depart_nom text, contact_depart_tel text,
  contact_depart_note text, contact_arrivee_nom text, contact_arrivee_tel text,
  contact_arrivee_note text, options_meta jsonb, vehicule_immatriculation text,
  vehicule_vin text, vehicule_energie text, vehicule_type text, vehicule_couleur text,
  vehicule_km integer, vehicule_notes text, type_mission text, commande_ref text,
  parent_trajet_id uuid, arrivee_contact_prenom text, arrivee_contact_societe text,
  archived_at timestamp with time zone, mission_group_id uuid, leg_type text, leg_index smallint,
  bidding_enabled boolean, attribution_mode text, allow_counter_offer boolean,
  proposal_expires_at timestamp with time zone, is_test_data boolean, mission_id uuid,
  date_souhaitee date, prix_total numeric, group_reference text, is_round_trip boolean,
  numero_mission text, arrivee_contact_email text, niveau_requis text, pv_digitalise text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    t.id, t.demande_id, t.depart, t.arrivee, t.date_trajet, t.heure_trajet,
    t.marque, t.modele, t.immatriculation, t.client_nom, t.client_telephone,
    t.client_email,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.attributions a WHERE a.trajet_id = t.id AND is_attribution_client(auth.uid(), a.id)
    ) THEN t.prix ELSE NULL END,
    t.statut, t.created_at, t.updated_at, t.statut_publication, t.pricing_mode, t.devis_id,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.attributions a WHERE a.trajet_id = t.id AND is_attribution_client(auth.uid(), a.id)
    ) THEN t.prix_client ELSE NULL END,
    t.published_at, t.vin, t.carte_grise_recto_url, t.carte_grise_verso_url,
    t.arrivee_contact_nom, t.arrivee_contact_telephone, t.arrivee_contact_telephone2,
    t.arrivee_contact_instructions, t.contact_depart_nom, t.contact_depart_tel,
    t.contact_depart_note, t.contact_arrivee_nom, t.contact_arrivee_tel, t.contact_arrivee_note,
    t.options_meta, t.vehicule_immatriculation, t.vehicule_vin, t.vehicule_energie,
    t.vehicule_type, t.vehicule_couleur, t.vehicule_km, t.vehicule_notes, t.type_mission,
    t.commande_ref, t.parent_trajet_id, t.arrivee_contact_prenom, t.arrivee_contact_societe,
    t.archived_at, t.mission_group_id, t.leg_type, t.leg_index, t.bidding_enabled,
    t.attribution_mode, t.allow_counter_offer, t.proposal_expires_at, t.is_test_data,
    t.mission_id, t.date_souhaitee,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.attributions a WHERE a.trajet_id = t.id AND is_attribution_client(auth.uid(), a.id)
    ) THEN t.prix_total ELSE NULL END,
    t.group_reference, t.is_round_trip, t.numero_mission, t.arrivee_contact_email,
    t.niveau_requis, t.pv_digitalise
  FROM public.trajets t
  WHERE auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE a.trajet_id = t.id AND c.user_id = auth.uid()
        AND a.statut = ANY (ARRAY['accepte','en_cours','termine','terminee','validee'])
    )
    OR EXISTS (
      SELECT 1 FROM public.attributions a
      WHERE a.trajet_id = t.id AND is_attribution_client(auth.uid(), a.id)
    )
  );
$function$;

REVOKE ALL ON FUNCTION public._trajets_client_safe_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._trajets_client_safe_rows() TO authenticated;

CREATE VIEW public.trajets_client_safe WITH (security_invoker = on) AS
  SELECT * FROM public._trajets_client_safe_rows();
GRANT SELECT ON public.trajets_client_safe TO authenticated;