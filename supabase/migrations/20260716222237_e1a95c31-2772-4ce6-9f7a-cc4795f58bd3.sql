
-- 1. Colonne is_test_data pour marquer les missions de test admin
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trajets_is_test_data
  ON public.trajets(is_test_data) WHERE is_test_data = true;

-- 2. Recréer la vue publique convoyeurs pour exclure les tests
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
  AND COALESCE(t.is_test_data, false) = false
  AND public.is_validated_convoyeur(auth.uid());

GRANT SELECT ON public.trajets_publies_safe TO authenticated;

-- 3. Fonction : créer une mission test réservée admin
CREATE OR REPLACE FUNCTION public.admin_create_test_mission()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.trajets (
    depart, arrivee, date_trajet, heure_trajet,
    marque, modele, immatriculation,
    client_nom, client_email, client_telephone,
    prix, tarif_convoyeur, prix_client, prix_convoyeur,
    statut, statut_publication, attribution_mode,
    is_test_data
  ) VALUES (
    'TEST — Paris', 'TEST — Lyon',
    (CURRENT_DATE + INTERVAL '3 days')::date, '10:00',
    'Renault', 'Clio V', 'TEST-000-XX',
    'TEST — Client Ligneo', 'test@transportsligneo.fr', '+33000000000',
    450, 300, 450, 300,
    'en_attente', 'brouillon', 'direct',
    true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_test_mission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_test_mission() TO authenticated;

-- 4. Fonction : supprimer une mission test (cascade manuelle, réservée aux is_test_data=true)
CREATE OR REPLACE FUNCTION public.admin_delete_test_mission(_trajet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_test boolean;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT is_test_data INTO v_is_test FROM public.trajets WHERE id = _trajet_id;
  IF v_is_test IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not a test mission' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.mission_etape_history
   WHERE attribution_id IN (SELECT id FROM public.attributions WHERE trajet_id = _trajet_id);
  DELETE FROM public.mission_offres WHERE trajet_id = _trajet_id;
  DELETE FROM public.attributions WHERE trajet_id = _trajet_id;
  DELETE FROM public.trajets_admin_data WHERE trajet_id = _trajet_id;
  DELETE FROM public.trajets WHERE id = _trajet_id AND is_test_data = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_test_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_test_mission(uuid) TO authenticated;
