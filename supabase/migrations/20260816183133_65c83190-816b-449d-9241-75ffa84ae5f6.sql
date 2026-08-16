CREATE OR REPLACE FUNCTION public.admin_update_mission_infos(
  _trajet_id uuid,
  _patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'depart','arrivee','date_trajet','heure_trajet','date_souhaitee',
    'marque','modele','immatriculation','vin',
    'vehicule_immatriculation','vehicule_vin','vehicule_energie','vehicule_couleur','vehicule_km','vehicule_notes','vehicule_type',
    'client_nom','client_telephone','client_email',
    'contact_depart_nom','contact_depart_tel','contact_depart_note',
    'contact_arrivee_nom','contact_arrivee_tel','contact_arrivee_note',
    'arrivee_contact_nom','arrivee_contact_prenom','arrivee_contact_societe',
    'arrivee_contact_telephone','arrivee_contact_telephone2','arrivee_contact_email','arrivee_contact_instructions'
  ];
  k text;
  v text;
  old_row public.trajets%ROWTYPE;
  new_row public.trajets%ROWTYPE;
  sets text := '';
  changed jsonb := '[]'::jsonb;
  old_val text;
  setting public.notification_settings%ROWTYPE;
  client_uid uuid;
  conv_uid uuid;
  numero text;
  labels text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO old_row FROM public.trajets WHERE id = _trajet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;

  FOR k, v IN SELECT key, CASE WHEN jsonb_typeof(value) = 'null' THEN NULL ELSE trim(both '"' from value::text) END FROM jsonb_each(_patch)
  LOOP
    IF NOT (k = ANY(allowed)) THEN CONTINUE; END IF;
    EXECUTE format('SELECT ($1).%I::text', k) INTO old_val USING old_row;
    IF coalesce(old_val, '') IS DISTINCT FROM coalesce(v, '') THEN
      sets := sets || format('%I = %L, ', k, nullif(v, ''));
      changed := changed || jsonb_build_object('field', k, 'old', old_val, 'new', v);
    END IF;
  END LOOP;

  IF sets = '' THEN
    RETURN jsonb_build_object('changed', changed);
  END IF;

  EXECUTE format('UPDATE public.trajets SET %s updated_at = now() WHERE id = %L RETURNING *', sets, _trajet_id)
  INTO new_row;

  SELECT numero_mission INTO numero FROM public.attributions WHERE trajet_id = _trajet_id ORDER BY created_at DESC LIMIT 1;
  numero := coalesce(numero, new_row.numero_mission, 'Mission');

  SELECT string_agg(x.field, ', ') INTO labels
  FROM jsonb_to_recordset(changed) AS x(field text, old text, new text);

  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
  VALUES ('mission_infos_update', 'trajet', _trajet_id, auth.uid(),
          jsonb_build_object('numero', numero, 'changes', changed))
  ON CONFLICT DO NOTHING;

  SELECT * INTO setting FROM public.notification_settings WHERE key = 'mission_infos_modifiees';

  SELECT p.id INTO client_uid FROM public.profiles p
   WHERE new_row.client_email IS NOT NULL AND lower(p.email) = lower(new_row.client_email) LIMIT 1;
  IF coalesce(setting.enabled_client, true) AND client_uid IS NOT NULL THEN
    PERFORM public.create_user_notification(
      client_uid, 'mission_infos_modifiees',
      'Informations de mission mises à jour',
      numero || ' — ' || coalesce(labels, 'informations modifiées'),
      '/dashboard-client/missions', 'mission', 'normal', NULL, 'trajet', _trajet_id, jsonb_build_object('changes', changed));
  END IF;

  SELECT c.user_id INTO conv_uid
    FROM public.attributions a JOIN public.convoyeurs c ON c.id = a.convoyeur_id
   WHERE a.trajet_id = _trajet_id AND a.statut NOT IN ('annulee','refusee')
   ORDER BY a.created_at DESC LIMIT 1;
  IF coalesce(setting.enabled_convoyeur, true) AND conv_uid IS NOT NULL THEN
    PERFORM public.create_user_notification(
      conv_uid, 'mission_infos_modifiees',
      'Mission modifiée par l''exploitation',
      numero || ' — ' || coalesce(labels, 'informations modifiées'),
      '/convoyeur/missions', 'mission', 'high', NULL, 'trajet', _trajet_id, jsonb_build_object('changes', changed));
  END IF;

  IF coalesce(setting.enabled_admin, true) THEN
    PERFORM public.create_admin_notification(
      'mission_infos_modifiees',
      'Fiche mission modifiée',
      numero || ' — ' || coalesce(labels, 'informations modifiées'),
      'normal', 'trajet', _trajet_id, '/admin/missions/' || _trajet_id::text);
  END IF;

  RETURN jsonb_build_object('changed', changed);
END;
$$;