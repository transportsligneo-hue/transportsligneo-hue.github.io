DO $migration$
DECLARE
  v_oid oid;
  v_def text;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_convert_mission_to_duo'
    AND pg_get_function_identity_arguments(p.oid) = '_trajet_id uuid, _depart text, _arrivee text, _date date, _heure text, _immatriculation text, _vin text, _marque text, _modele text, _prix_retour numeric, _split_prix boolean';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fonction admin_convert_mission_to_duo introuvable';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  v_def := replace(v_def,
    'v_immat   := COALESCE(NULLIF(upper(btrim(COALESCE(_immatriculation, ''''))), ''''), t.immatriculation);',
    'v_immat   := NULLIF(upper(btrim(COALESCE(_immatriculation, ''''))), '''');');
  v_def := replace(v_def,
    'v_vin     := COALESCE(NULLIF(upper(btrim(COALESCE(_vin, ''''))), ''''), t.vin);',
    'v_vin     := NULLIF(upper(btrim(COALESCE(_vin, ''''))), '''');');
  v_def := replace(v_def,
    'v_marque  := COALESCE(NULLIF(btrim(COALESCE(_marque, '''')), ''''), t.marque);',
    'v_marque  := NULLIF(btrim(COALESCE(_marque, '''')), '''');');
  v_def := replace(v_def,
    'v_modele  := COALESCE(NULLIF(btrim(COALESCE(_modele, '''')), ''''), t.modele);',
    'v_modele  := NULLIF(btrim(COALESCE(_modele, '''')), '''');');
  v_def := replace(v_def,
    'date_retour = COALESCE(date_retour, v_date),
       immatriculation_retour = COALESCE(NULLIF(btrim(COALESCE(immatriculation_retour, '''')), ''''), v_immat),
       vin_retour = COALESCE(NULLIF(btrim(COALESCE(vin_retour, '''')), ''''), v_vin),',
    'date_retour = COALESCE(date_retour, v_date),
       marque_retour = v_marque,
       modele_retour = v_modele,
       immatriculation_retour = v_immat,
       vin_retour = v_vin,');
  EXECUTE v_def;
END
$migration$;

DO $migration$
DECLARE
  v_oid oid;
  v_def text;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_convert_devis_to_missions'
    AND pg_get_function_identity_arguments(p.oid) = '_devis_id uuid, _converted_by uuid, _mission_status text';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fonction admin_convert_devis_to_missions introuvable';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  v_def := replace(v_def,
    'marque = COALESCE(m.marque, d.marque), modele = COALESCE(m.modele, d.modele),',
    'marque = COALESCE(NULLIF(trim(d.marque), ''''), m.marque), modele = COALESCE(NULLIF(trim(d.modele), ''''), m.modele),');
  v_def := replace(v_def,
    'marque = COALESCE(m.marque, d.marque_retour, d.marque), modele = COALESCE(m.modele, d.modele_retour, d.modele),',
    'marque = COALESCE(NULLIF(trim(d.marque_retour), ''''), m.marque), modele = COALESCE(NULLIF(trim(d.modele_retour), ''''), m.modele),');
  v_def := replace(v_def,
    'leg_type = CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN ''retour'' WHEN v_is_ar THEN ''aller'' ELSE ''simple'' END,
    immatriculation = COALESCE(',
    'leg_type = CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN ''retour'' WHEN v_is_ar THEN ''aller'' ELSE ''simple'' END,
    marque = CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN COALESCE(NULLIF(trim(d.marque_retour), ''''), marque) ELSE COALESCE(NULLIF(trim(d.marque), ''''), marque) END,
    modele = CASE WHEN v_is_ar AND COALESCE(leg_index, 1) = 2 THEN COALESCE(NULLIF(trim(d.modele_retour), ''''), modele) ELSE COALESCE(NULLIF(trim(d.modele), ''''), modele) END,
    immatriculation = COALESCE(');
  EXECUTE v_def;
END
$migration$;

REVOKE ALL ON FUNCTION public.admin_convert_mission_to_duo(uuid, text, text, date, text, text, text, text, text, numeric, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_convert_mission_to_duo(uuid, text, text, date, text, text, text, text, text, numeric, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_convert_mission_to_duo(uuid, text, text, date, text, text, text, text, text, numeric, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_convert_devis_to_missions(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_convert_devis_to_missions(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_convert_devis_to_missions(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_convert_devis_to_missions(uuid, uuid, text) TO service_role;