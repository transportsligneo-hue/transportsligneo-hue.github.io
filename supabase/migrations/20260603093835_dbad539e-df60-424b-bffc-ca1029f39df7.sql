
-- ============================================================
-- 1. Storage cartes-grises : ownership EXISTS join sur devis
-- ============================================================
DROP POLICY IF EXISTS "Clients upload own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients update own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients delete own carte grise" ON storage.objects;

CREATE POLICY "Clients read own carte grise"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Clients upload own carte grise"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Clients update own carte grise"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(name))[2]
      AND d.paid_at IS NULL
  )
);

CREATE POLICY "Clients delete own carte grise"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(name))[2]
      AND d.paid_at IS NULL
  )
);

-- ============================================================
-- 2. Trajets : vue sécurisée pour convoyeurs (sans PII client)
-- ============================================================
DROP VIEW IF EXISTS public.trajets_assigned_safe;

CREATE VIEW public.trajets_assigned_safe AS
SELECT
  t.id, t.demande_id, t.devis_id,
  t.depart, t.arrivee, t.date_trajet, t.heure_trajet,
  t.marque, t.modele, t.immatriculation,
  -- Contacts opérationnels (autorisés pour convoyeur)
  t.contact_depart_nom, t.contact_depart_tel, t.contact_depart_note,
  t.contact_arrivee_nom, t.contact_arrivee_tel, t.contact_arrivee_note,
  t.arrivee_contact_nom, t.arrivee_contact_telephone,
  t.arrivee_contact_telephone2, t.arrivee_contact_instructions,
  -- Carte grise + VIN nécessaires à l'EDL (le convoyeur conduit le véhicule)
  t.vin, t.carte_grise_recto_url, t.carte_grise_verso_url,
  -- Détails véhicule
  t.vehicule_immatriculation, t.vehicule_vin, t.vehicule_energie,
  t.vehicule_type, t.vehicule_couleur, t.vehicule_km, t.vehicule_notes,
  -- Tarif côté convoyeur uniquement (pas prix_client / prix_societe)
  t.tarif_convoyeur, t.prix_convoyeur, t.commission_convoyeur_pct,
  t.prix_suggere, t.prix_convoyeur_fixe, t.prix_convoyeur_min, t.prix_convoyeur_max,
  t.pricing_mode, t.statut, t.statut_publication, t.published_at,
  t.options_meta,
  t.created_at, t.updated_at
FROM public.trajets t
WHERE EXISTS (
  SELECT 1 FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE a.trajet_id = t.id
    AND c.user_id = auth.uid()
);

-- security_invoker=off (par défaut) : la vue tourne avec les droits du owner (postgres)
-- et bypasse les RLS sur trajets. La sécurité vient du WHERE auth.uid().
ALTER VIEW public.trajets_assigned_safe SET (security_invoker = off);

GRANT SELECT ON public.trajets_assigned_safe TO authenticated;
GRANT SELECT ON public.trajets_assigned_safe TO service_role;

-- Drop la policy permissive qui exposait toutes les PII clients
DROP POLICY IF EXISTS "Convoyeurs can see assigned trajets" ON public.trajets;
