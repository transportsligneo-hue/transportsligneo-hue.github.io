-- 1) Réglages centralisés des notifications
CREATE TABLE IF NOT EXISTS public.notification_settings (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  groupe text NOT NULL DEFAULT 'general',
  enabled_admin boolean NOT NULL DEFAULT true,
  enabled_client boolean NOT NULL DEFAULT true,
  enabled_convoyeur boolean NOT NULL DEFAULT true,
  enabled_push boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_admin_all" ON public.notification_settings;
CREATE POLICY "notification_settings_admin_all"
  ON public.notification_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_settings (key, label, description, groupe) VALUES
  ('mission_infos_modifiees', 'Modification des informations mission', 'Plaque, VIN, véhicule, adresses, date/heure, contacts', 'missions'),
  ('mission_acceptee', 'Mission acceptée par un convoyeur', NULL, 'missions'),
  ('mission_offre', 'Nouvelle offre / candidature convoyeur', NULL, 'missions'),
  ('mission_terminee', 'Mission terminée', NULL, 'missions'),
  ('mission_annulee', 'Mission annulée / clôturée', NULL, 'missions'),
  ('mission_attribuee', 'Mission attribuée à un convoyeur', NULL, 'missions'),
  ('incident', 'Incident signalé', NULL, 'exploitation'),
  ('alerte_operationnelle', 'Alerte opérationnelle (mission à risque)', NULL, 'exploitation'),
  ('devis', 'Nouveau devis / devis accepté', NULL, 'commercial'),
  ('estimation', 'Nouvelle estimation en ligne', NULL, 'commercial'),
  ('facture', 'Facture émise / payée', NULL, 'commercial'),
  ('b2b_lead', 'Nouveau lead B2B', NULL, 'commercial'),
  ('b2b_paiement', 'Paiement B2B', NULL, 'commercial'),
  ('client_action', 'Action client (inscription, document…)', NULL, 'comptes'),
  ('driver_action', 'Action convoyeur (inscription, document…)', NULL, 'comptes')
ON CONFLICT (key) DO NOTHING;

-- 2) Modification des infos d'une mission par un admin + notifications
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
    'depart','arrivee','date_trajet','heure_trajet',
    'marque','modele','immatriculation','vin',
    'vehicule_immatriculation','vehicule_vin','vehicule_energie','vehicule_couleur','vehicule_km','vehicule_notes',
    'client_nom','client_telephone','client_email',
    'contact_depart_nom','contact_depart_tel','contact_depart_note',
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

  -- Client
  SELECT p.id INTO client_uid FROM public.profiles p
   WHERE new_row.client_email IS NOT NULL AND lower(p.email) = lower(new_row.client_email) LIMIT 1;
  IF coalesce(setting.enabled_client, true) AND client_uid IS NOT NULL THEN
    PERFORM public.create_user_notification(
      client_uid, 'mission_infos_modifiees',
      'Informations de mission mises à jour',
      numero || ' — ' || coalesce(labels, 'informations modifiées'),
      '/dashboard-client/missions', 'mission', 'normal', NULL, 'trajet', _trajet_id, jsonb_build_object('changes', changed));
  END IF;

  -- Convoyeur
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

  -- Admin
  IF coalesce(setting.enabled_admin, true) THEN
    PERFORM public.create_admin_notification(
      'client_action',
      'Mission modifiée · ' || numero,
      coalesce(labels, 'informations modifiées'),
      NULL, 'trajet', _trajet_id, jsonb_build_object('changes', changed));
  END IF;

  RETURN jsonb_build_object('changed', changed, 'push', coalesce(setting.enabled_push, true));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_mission_infos(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_mission_infos(uuid, jsonb) TO authenticated;