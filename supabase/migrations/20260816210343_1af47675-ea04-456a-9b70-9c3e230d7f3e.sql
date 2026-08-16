-- 1) Remplacer la vue SECURITY DEFINER par une vue security_invoker + fonction contrôlée
CREATE OR REPLACE FUNCTION public._trajets_assigned_safe_rows()
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
  tarif_convoyeur numeric, prix_convoyeur numeric, commission_convoyeur_pct numeric,
  prix_suggere numeric, prix_convoyeur_fixe numeric, prix_convoyeur_min numeric,
  prix_convoyeur_max numeric, pricing_mode text, statut text, statut_publication text,
  published_at timestamptz, options_meta jsonb, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    t.tarif_convoyeur, t.prix_convoyeur, t.commission_convoyeur_pct,
    t.prix_suggere, t.prix_convoyeur_fixe, t.prix_convoyeur_min,
    t.prix_convoyeur_max, t.pricing_mode, t.statut, t.statut_publication,
    t.published_at, t.options_meta, t.created_at, t.updated_at
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

DROP VIEW IF EXISTS public.trajets_assigned_safe;
CREATE VIEW public.trajets_assigned_safe WITH (security_invoker = on) AS
  SELECT * FROM public._trajets_assigned_safe_rows();

GRANT SELECT ON public.trajets_assigned_safe TO authenticated;

-- 2) Cartes grises : vérification par le chemin canonique stocké en base
DROP POLICY IF EXISTS "Convoyeurs read assigned cartes grises" ON storage.objects;
CREATE POLICY "Convoyeurs read assigned cartes grises"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE c.user_id = auth.uid()
      AND a.statut = ANY (ARRAY['accepte','en_cours','terminee','termine'])
      AND (t.carte_grise_recto_url = storage.objects.name
        OR t.carte_grise_verso_url = storage.objects.name)
  )
);

-- 3) Newsletter : validation des inscriptions publiques
ALTER TABLE public.newsletter_abonnes
  ADD CONSTRAINT newsletter_abonnes_email_valid
  CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~ '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ) NOT VALID;

DROP POLICY IF EXISTS "newsletter_public_insert" ON public.newsletter_abonnes;
CREATE POLICY "newsletter_public_insert"
ON public.newsletter_abonnes FOR INSERT TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 254
  AND email ~ '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND (source IS NULL OR length(source) <= 60)
  AND unsubscribed_at IS NULL
);