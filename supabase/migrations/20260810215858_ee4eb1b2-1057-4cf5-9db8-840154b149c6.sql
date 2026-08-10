-- 1. Table des alertes opérationnelles
CREATE TABLE public.mission_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'attention',
  base_severity text NOT NULL DEFAULT 'attention',
  status text NOT NULL DEFAULT 'open',
  titre text NOT NULL,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  escalated_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_alerts_severity_check CHECK (severity IN ('info','attention','critique')),
  CONSTRAINT mission_alerts_base_severity_check CHECK (base_severity IN ('info','attention','critique')),
  CONSTRAINT mission_alerts_status_check CHECK (status IN ('open','acknowledged','resolved'))
);

GRANT SELECT ON public.mission_alerts TO authenticated;
GRANT ALL ON public.mission_alerts TO service_role;

ALTER TABLE public.mission_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mission alerts" ON public.mission_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE UNIQUE INDEX mission_alerts_unique_open
  ON public.mission_alerts (attribution_id, alert_type)
  WHERE status <> 'resolved';
CREATE INDEX idx_mission_alerts_status ON public.mission_alerts (status, severity, triggered_at DESC);
CREATE INDEX idx_mission_alerts_attribution ON public.mission_alerts (attribution_id);

CREATE TRIGGER trg_mission_alerts_updated
  BEFORE UPDATE ON public.mission_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_alerts;

-- 2. Réglages par défaut
INSERT INTO public.app_settings (key, value)
VALUES ('alertes_operationnelles', jsonb_build_object(
  'enabled', true,
  'escalade_minutes', 30,
  'types', jsonb_build_object(
    'acceptee_non_demarree', jsonb_build_object('enabled', true, 'seuil', 30, 'severite', 'attention'),
    'creneau_enlevement_depasse', jsonb_build_object('enabled', true, 'seuil', 0, 'severite', 'attention'),
    'trajet_enlevement_long', jsonb_build_object('enabled', true, 'seuil', 120, 'severite', 'attention'),
    'gps_silence', jsonb_build_object('enabled', true, 'seuil', 20, 'severite', 'critique'),
    'edl_depart_manquant', jsonb_build_object('enabled', true, 'seuil', 15, 'severite', 'attention'),
    'creneau_livraison_depasse', jsonb_build_object('enabled', true, 'seuil', 480, 'severite', 'attention'),
    'incident_non_pris_en_charge', jsonb_build_object('enabled', true, 'seuil', 10, 'severite', 'critique')
  )
))
ON CONFLICT (key) DO NOTHING;

-- 3. Helper : timestamp d'enlèvement prévu
CREATE OR REPLACE FUNCTION public.mission_pickup_ts(_date date, _heure text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_h text := coalesce(nullif(trim(replace(coalesce(_heure,''), 'h', ':')), ''), '09:00');
  v_ts timestamptz;
BEGIN
  IF _date IS NULL THEN RETURN NULL; END IF;
  BEGIN
    v_ts := ((_date::text || ' ' || v_h)::timestamp) AT TIME ZONE 'Europe/Paris';
  EXCEPTION WHEN others THEN
    v_ts := ((_date::text || ' 09:00')::timestamp) AT TIME ZONE 'Europe/Paris';
  END;
  RETURN v_ts;
END;
$$;

-- 4. Détection automatique
CREATE OR REPLACE FUNCTION public.detect_mission_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_types jsonb;
  v_escalade int;
  v_created int := 0;
  v_resolved int := 0;
  v_escalated int := 0;
  r record;
BEGIN
  SELECT value INTO v_cfg FROM public.app_settings WHERE key = 'alertes_operationnelles';
  IF v_cfg IS NULL OR coalesce((v_cfg->>'enabled')::boolean, true) = false THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;
  v_types := coalesce(v_cfg->'types', '{}'::jsonb);
  v_escalade := coalesce((v_cfg->>'escalade_minutes')::int, 30);

  CREATE TEMP TABLE _detected (
    attribution_id uuid,
    alert_type text,
    severity text,
    titre text,
    message text,
    details jsonb
  ) ON COMMIT DROP;

  INSERT INTO _detected (attribution_id, alert_type, severity, titre, message, details)
  WITH base AS (
    SELECT
      a.id AS attribution_id,
      a.numero_mission,
      a.etape_courante,
      a.statut,
      a.statut_convoyeur,
      t.depart, t.arrivee,
      public.mission_pickup_ts(t.date_trajet, t.heure_trajet) AS pickup_ts,
      (SELECT max(l.recorded_at) FROM public.mission_locations l WHERE l.attribution_id = a.id) AS last_gps,
      (SELECT max(h.created_at) FROM public.mission_etape_history h
         WHERE h.attribution_id = a.id AND h.etape = 'prise_en_charge') AS prise_en_charge_at,
      EXISTS (SELECT 1 FROM public.inspections i
               WHERE i.attribution_id = a.id AND i.type = 'depart' AND i.statut = 'complete') AS edl_depart_ok,
      (SELECT min(mi.created_at) FROM public.mission_incidents mi
         WHERE mi.attribution_id = a.id AND mi.statut = 'ouvert') AS incident_ouvert_at
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE a.statut_convoyeur = 'accepte'
      AND a.annulation_at IS NULL
      AND coalesce(a.etape_courante, '') NOT IN ('en_attente_validation', 'edl_arrivee_fait')
      AND coalesce(a.statut, '') NOT IN ('termine', 'terminee', 'annule', 'annulee')
      AND t.date_trajet >= (current_date - 7)
  )
  SELECT * FROM (
    -- Mission acceptée non démarrée (créneau proche)
    SELECT b.attribution_id, 'acceptee_non_demarree',
      coalesce(v_types->'acceptee_non_demarree'->>'severite','attention'),
      'Mission acceptée non démarrée',
      'Le convoyeur n''a pas démarré son trajet alors que le créneau d''enlèvement approche (' || b.depart || ' → ' || b.arrivee || ').',
      jsonb_build_object('pickup_ts', b.pickup_ts)
    FROM base b
    WHERE coalesce((v_types->'acceptee_non_demarree'->>'enabled')::boolean, true)
      AND coalesce(b.etape_courante, '') = ''
      AND b.pickup_ts IS NOT NULL
      AND now() >= b.pickup_ts - make_interval(mins => coalesce((v_types->'acceptee_non_demarree'->>'seuil')::int, 30))
      AND now() < b.pickup_ts

    UNION ALL
    -- Créneau d'enlèvement dépassé
    SELECT b.attribution_id, 'creneau_enlevement_depasse',
      coalesce(v_types->'creneau_enlevement_depasse'->>'severite','attention'),
      'Créneau d''enlèvement dépassé',
      'Le créneau d''enlèvement est dépassé et la mission n''a toujours pas démarré (' || b.depart || ').',
      jsonb_build_object('pickup_ts', b.pickup_ts)
    FROM base b
    WHERE coalesce((v_types->'creneau_enlevement_depasse'->>'enabled')::boolean, true)
      AND coalesce(b.etape_courante, '') = ''
      AND b.pickup_ts IS NOT NULL
      AND now() > b.pickup_ts + make_interval(mins => coalesce((v_types->'creneau_enlevement_depasse'->>'seuil')::int, 0))

    UNION ALL
    -- Trajet vers l'enlèvement anormalement long
    SELECT b.attribution_id, 'trajet_enlevement_long',
      coalesce(v_types->'trajet_enlevement_long'->>'severite','attention'),
      'Prise en charge du véhicule trop longue',
      'La mission est démarrée mais le véhicule n''est toujours pas pris en charge (' || b.depart || ').',
      jsonb_build_object('pickup_ts', b.pickup_ts)
    FROM base b
    WHERE coalesce((v_types->'trajet_enlevement_long'->>'enabled')::boolean, true)
      AND coalesce(b.etape_courante, '') IN ('sur_place')
      AND b.pickup_ts IS NOT NULL
      AND now() > b.pickup_ts + make_interval(mins => coalesce((v_types->'trajet_enlevement_long'->>'seuil')::int, 120))

    UNION ALL
    -- Silence de suivi GPS
    SELECT b.attribution_id, 'gps_silence',
      coalesce(v_types->'gps_silence'->>'severite','critique'),
      'Silence du suivi GPS',
      'Aucune position reçue depuis plus de ' || coalesce((v_types->'gps_silence'->>'seuil')::int, 20) || ' minutes alors que la mission est en cours.',
      jsonb_build_object('last_gps', b.last_gps)
    FROM base b
    WHERE coalesce((v_types->'gps_silence'->>'enabled')::boolean, true)
      AND coalesce(b.etape_courante, '') IN ('prise_en_charge', 'arrive_destination')
      AND b.last_gps IS NOT NULL
      AND now() > b.last_gps + make_interval(mins => coalesce((v_types->'gps_silence'->>'seuil')::int, 20))

    UNION ALL
    -- EDL de départ non complété
    SELECT b.attribution_id, 'edl_depart_manquant',
      coalesce(v_types->'edl_depart_manquant'->>'severite','attention'),
      'État des lieux de départ manquant',
      'Le véhicule est marqué récupéré mais l''état des lieux de départ n''a pas été soumis.',
      jsonb_build_object('prise_en_charge_at', b.prise_en_charge_at)
    FROM base b
    WHERE coalesce((v_types->'edl_depart_manquant'->>'enabled')::boolean, true)
      AND coalesce(b.etape_courante, '') IN ('prise_en_charge', 'arrive_destination')
      AND b.edl_depart_ok = false
      AND coalesce(b.prise_en_charge_at, b.pickup_ts) IS NOT NULL
      AND now() > coalesce(b.prise_en_charge_at, b.pickup_ts) + make_interval(mins => coalesce((v_types->'edl_depart_manquant'->>'seuil')::int, 15))

    UNION ALL
    -- Créneau de livraison dépassé
    SELECT b.attribution_id, 'creneau_livraison_depasse',
      coalesce(v_types->'creneau_livraison_depasse'->>'severite','attention'),
      'Créneau de livraison dépassé',
      'La mission vers ' || b.arrivee || ' n''est toujours pas terminée au-delà du délai de livraison prévu.',
      jsonb_build_object('pickup_ts', b.pickup_ts)
    FROM base b
    WHERE coalesce((v_types->'creneau_livraison_depasse'->>'enabled')::boolean, true)
      AND b.pickup_ts IS NOT NULL
      AND now() > b.pickup_ts + make_interval(mins => coalesce((v_types->'creneau_livraison_depasse'->>'seuil')::int, 480))

    UNION ALL
    -- Incident signalé sans prise en charge
    SELECT b.attribution_id, 'incident_non_pris_en_charge',
      coalesce(v_types->'incident_non_pris_en_charge'->>'severite','critique'),
      'Incident non pris en charge',
      'Un incident signalé par le convoyeur est toujours sans réponse admin.',
      jsonb_build_object('incident_at', b.incident_ouvert_at)
    FROM base b
    WHERE coalesce((v_types->'incident_non_pris_en_charge'->>'enabled')::boolean, true)
      AND b.incident_ouvert_at IS NOT NULL
      AND now() > b.incident_ouvert_at + make_interval(mins => coalesce((v_types->'incident_non_pris_en_charge'->>'seuil')::int, 10))
  ) s;

  -- Résolution automatique
  UPDATE public.mission_alerts ma
  SET status = 'resolved', resolved_at = now()
  WHERE ma.status <> 'resolved'
    AND NOT EXISTS (
      SELECT 1 FROM _detected d
      WHERE d.attribution_id = ma.attribution_id AND d.alert_type = ma.alert_type
    );
  GET DIAGNOSTICS v_resolved = ROW_COUNT;

  -- Création des nouvelles alertes
  FOR r IN
    SELECT d.* FROM _detected d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mission_alerts ma
      WHERE ma.attribution_id = d.attribution_id
        AND ma.alert_type = d.alert_type
        AND ma.status <> 'resolved'
    )
  LOOP
    INSERT INTO public.mission_alerts
      (attribution_id, alert_type, severity, base_severity, titre, message, details)
    VALUES (r.attribution_id, r.alert_type, r.severity, r.severity, r.titre, r.message, r.details)
    ON CONFLICT DO NOTHING;
    v_created := v_created + 1;

    IF r.severity = 'critique' THEN
      INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
      VALUES ('incident', '[Critique] ' || r.titre, r.message, '/admin/alertes', 'attribution', r.attribution_id,
              jsonb_build_object('alert_type', r.alert_type, 'severity', r.severity));
    END IF;
  END LOOP;

  -- Escalade attention -> critique
  UPDATE public.mission_alerts
  SET severity = 'critique', escalated_at = now()
  WHERE status = 'open'
    AND severity = 'attention'
    AND acknowledged_at IS NULL
    AND triggered_at < now() - make_interval(mins => v_escalade);
  GET DIAGNOSTICS v_escalated = ROW_COUNT;

  RETURN jsonb_build_object(
    'enabled', true,
    'created', v_created,
    'resolved', v_resolved,
    'escalated', v_escalated,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_mission_alerts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_mission_alerts() TO service_role;

-- 5. Prise en compte d'une alerte par un admin
CREATE OR REPLACE FUNCTION public.acknowledge_mission_alert(_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.mission_alerts
  SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
  WHERE id = _alert_id AND status = 'open';
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_mission_alert(uuid) TO authenticated;

-- 6. Exécution manuelle de la détection depuis l'admin
CREATE OR REPLACE FUNCTION public.admin_run_alert_detection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.detect_mission_alerts();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_alert_detection() TO authenticated;