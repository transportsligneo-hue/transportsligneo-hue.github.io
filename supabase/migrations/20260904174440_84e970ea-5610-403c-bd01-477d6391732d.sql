DROP VIEW IF EXISTS public.trajets_assigned_safe;

DROP FUNCTION IF EXISTS public._trajets_assigned_safe_rows();

CREATE OR REPLACE FUNCTION public._trajets_assigned_safe_rows()
 RETURNS TABLE(id uuid, demande_id uuid, devis_id uuid, depart text, arrivee text, date_trajet date, heure_trajet text, marque text, modele text, immatriculation text, contact_depart_nom text, contact_depart_tel text, contact_depart_note text, contact_arrivee_nom text, contact_arrivee_tel text, contact_arrivee_note text, arrivee_contact_nom text, arrivee_contact_telephone text, arrivee_contact_telephone2 text, arrivee_contact_instructions text, vin text, carte_grise_recto_url text, carte_grise_verso_url text, vehicule_immatriculation text, vehicule_vin text, vehicule_energie text, vehicule_type text, vehicule_couleur text, vehicule_km integer, vehicule_notes text, tarif_convoyeur numeric, prix_suggere numeric, prix_convoyeur_fixe numeric, statut text, statut_publication text, published_at timestamp with time zone, options_meta jsonb, numero_mission text, mission_group_id uuid, leg_type text, type_mission text, pv_digitalise text, date_souhaitee date, created_at timestamp with time zone, updated_at timestamp with time zone, non_roulant boolean)
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
    t.pv_digitalise, t.date_souhaitee, t.created_at, t.updated_at,
    t.non_roulant
  FROM public.trajets t
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE a.trajet_id = t.id AND c.user_id = auth.uid()
    );
$function$;

CREATE VIEW public.trajets_assigned_safe
WITH (security_invoker = true)
AS SELECT * FROM public._trajets_assigned_safe_rows();

GRANT SELECT ON public.trajets_assigned_safe TO authenticated;
REVOKE ALL ON FUNCTION public._trajets_assigned_safe_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._trajets_assigned_safe_rows() TO authenticated;