CREATE OR REPLACE FUNCTION public.admin_create_test_mission(_target_convoyeur_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_convoyeur_id uuid := _target_convoyeur_id;
  v_routes text[][] := ARRAY[
    ARRAY['Tours','Paris'], ARRAY['Tours','Marseille'], ARRAY['Tours','Bordeaux'],
    ARRAY['Paris','Lyon'], ARRAY['Nantes','Toulouse'], ARRAY['Lille','Rennes'],
    ARRAY['Orléans','Nice'], ARRAY['Angers','Strasbourg']
  ];
  v_vehicules text[][] := ARRAY[
    ARRAY['Renault','Clio V'], ARRAY['Peugeot','308'], ARRAY['Volkswagen','Golf 8'],
    ARRAY['Citroën','C3'], ARRAY['Dacia','Sandero'], ARRAY['Toyota','Yaris']
  ];
  r int := 1 + floor(random() * array_length(v_routes, 1))::int;
  v int := 1 + floor(random() * array_length(v_vehicules, 1))::int;
  v_plate text := chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int)
                  || '-' || lpad(floor(random()*900 + 100)::int::text, 3, '0') || '-'
                  || chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int);
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
    v_routes[r][1], v_routes[r][2],
    (CURRENT_DATE + INTERVAL '3 days')::date, '10:00',
    v_vehicules[v][1], v_vehicules[v][2], v_plate,
    'Client Démo', 'test@transportsligneo.fr', '+33000000000',
    450, 300, 450, 300,
    'en_attente',
    CASE WHEN v_convoyeur_id IS NULL THEN 'publie' ELSE 'brouillon' END,
    CASE WHEN v_convoyeur_id IS NULL THEN 'catalogue' ELSE 'direct' END,
    true
  )
  RETURNING id INTO v_id;

  IF v_convoyeur_id IS NOT NULL THEN
    INSERT INTO public.attributions (
      trajet_id, convoyeur_id, mode, statut, statut_convoyeur, propose_at
    ) VALUES (
      v_id, v_convoyeur_id, 'directe', 'proposee', 'en_attente', now()
    );
  END IF;

  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_delete_test_mission(_trajet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_is_test boolean;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_max int := 0;
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

  SELECT COALESCE(MAX(n), 0) INTO v_max FROM (
    SELECT (regexp_replace(numero, '^MIS-TLG-[0-9]{4}-#?', ''))::int AS n
      FROM public.missions
     WHERE numero ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
    UNION ALL
    SELECT (regexp_replace(numero_mission, '^MIS-TLG-[0-9]{4}-#?', ''))::int
      FROM public.trajets
     WHERE numero_mission ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
    UNION ALL
    SELECT (regexp_replace(numero_mission, '^MIS-TLG-[0-9]{4}-#?', ''))::int
      FROM public.attributions
     WHERE numero_mission ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
  ) s;

  UPDATE public.mission_sequences
     SET current_value = v_max, updated_at = now()
   WHERE prefix = 'MIS-TLG' AND year = v_year;
END;
$fn$;