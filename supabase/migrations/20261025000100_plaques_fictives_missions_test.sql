-- Missions de test et démo : plaques d'immatriculation fictives (jamais de vraie plaque).

CREATE OR REPLACE FUNCTION public.convoyeur_create_test_mission()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
  v_id uuid;
  v_active int;
  v_routes text[][] := ARRAY[
    ARRAY['Tours','Paris'], ARRAY['Tours','Bordeaux'], ARRAY['Paris','Lyon'],
    ARRAY['Nantes','Toulouse'], ARRAY['Lille','Rennes'], ARRAY['Angers','Strasbourg']
  ];
  v_vehicules text[][] := ARRAY[
    ARRAY['Renault','Clio V'], ARRAY['Peugeot','308'], ARRAY['Volkswagen','Golf 8'],
    ARRAY['Citroën','C3'], ARRAY['Dacia','Sandero'], ARRAY['Toyota','Yaris']
  ];
  r int := 1 + floor(random() * array_length(v_routes, 1))::int;
  v int := 1 + floor(random() * array_length(v_vehicules, 1))::int;
  -- Plaques fictives : les lettres I, O et U n'existent pas sur les vraies plaques SIV,
  -- et AA-123-BB / AB-123-CD sont les plaques d'exemple. Aucune ne peut être celle d'un vrai véhicule.
  v_plate text := (ARRAY['AA-123-BB','AB-123-CD','OO-123-OO','UU-456-UU','II-789-II','OU-321-IO'])[1 + floor(random()*6)::int];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_conv FROM public.convoyeurs WHERE user_id = v_uid AND is_tester = true LIMIT 1;
  IF v_conv IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  -- Garde-fou : 5 missions de test en cours maximum par testeur.
  SELECT count(*) INTO v_active FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
   WHERE a.convoyeur_id = v_conv AND t.is_test_data = true
     AND a.statut IN ('proposee','propose','accepte','en_cours');
  IF v_active >= 5 THEN RAISE EXCEPTION 'Vous avez déjà 5 missions de test en cours.' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.trajets (
    depart, arrivee, date_trajet, heure_trajet,
    marque, modele, immatriculation,
    client_nom, client_email, client_telephone,
    prix, tarif_convoyeur, prix_client, prix_convoyeur,
    statut, statut_publication, attribution_mode, is_test_data
  ) VALUES (
    v_routes[r][1], v_routes[r][2],
    CURRENT_DATE, '14:00',
    v_vehicules[v][1], v_vehicules[v][2], v_plate,
    'Client Démo', 'test@transportsligneo.fr', '+33000000000',
    450, 300, 450, 300,
    'en_attente', 'brouillon', 'direct', true
  ) RETURNING id INTO v_id;

  INSERT INTO public.attributions (trajet_id, convoyeur_id, mode, statut, statut_convoyeur, propose_at)
  VALUES (v_id, v_conv, 'directe', 'proposee', 'en_attente', now());

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.convoyeur_create_test_mission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convoyeur_create_test_mission() TO authenticated;

-- Remplace les plaques des missions de test déjà créées.
UPDATE public.trajets
   SET immatriculation = (ARRAY['AA-123-BB','AB-123-CD','OO-123-OO','UU-456-UU','II-789-II','OU-321-IO'])[1 + floor(random()*6)::int]
 WHERE is_test_data = true
   AND coalesce(immatriculation,'') NOT IN ('AA-123-BB','AB-123-CD','OO-123-OO','UU-456-UU','II-789-II','OU-321-IO');
