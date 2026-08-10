ALTER TABLE public.mission_incidents
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS prise_en_charge_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mission_incidents_created_at ON public.mission_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_incidents_type ON public.mission_incidents (type_incident);
CREATE INDEX IF NOT EXISTS idx_mission_incidents_gravite ON public.mission_incidents (gravite);
CREATE INDEX IF NOT EXISTS idx_mission_incidents_convoyeur ON public.mission_incidents (convoyeur_user_id);
CREATE INDEX IF NOT EXISTS idx_mission_incidents_search ON public.mission_incidents USING gin ((titre || ' ' || description) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.mission_incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('statut', 'assignation', 'commentaire', 'creation')),
  from_statut text,
  to_statut text,
  assigned_to uuid,
  commentaire text,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.incident_events TO authenticated;
GRANT ALL ON public.incident_events TO service_role;

ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read incident events" ON public.incident_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON public.incident_events (incident_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_update_incident(
  _incident_id uuid,
  _statut text DEFAULT NULL,
  _assigned_to uuid DEFAULT NULL,
  _commentaire text DEFAULT NULL,
  _clear_assignation boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.mission_incidents%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_old FROM public.mission_incidents WHERE id = _incident_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident introuvable';
  END IF;

  IF _statut IS NOT NULL AND _statut <> v_old.statut THEN
    IF _statut NOT IN ('ouvert', 'en_cours', 'resolu', 'annule') THEN
      RAISE EXCEPTION 'statut invalide';
    END IF;
    UPDATE public.mission_incidents
       SET statut = _statut,
           resolu_at = CASE WHEN _statut IN ('resolu', 'annule') THEN COALESCE(resolu_at, now()) ELSE NULL END,
           prise_en_charge_at = CASE WHEN _statut = 'ouvert' THEN prise_en_charge_at ELSE COALESCE(prise_en_charge_at, now()) END
     WHERE id = _incident_id;

    INSERT INTO public.incident_events (incident_id, event_type, from_statut, to_statut, author_id)
    VALUES (_incident_id, 'statut', v_old.statut, _statut, auth.uid());
  END IF;

  IF _clear_assignation THEN
    UPDATE public.mission_incidents SET assigned_to = NULL WHERE id = _incident_id;
    INSERT INTO public.incident_events (incident_id, event_type, assigned_to, author_id)
    VALUES (_incident_id, 'assignation', NULL, auth.uid());
  ELSIF _assigned_to IS NOT NULL AND _assigned_to IS DISTINCT FROM v_old.assigned_to THEN
    UPDATE public.mission_incidents SET assigned_to = _assigned_to WHERE id = _incident_id;
    INSERT INTO public.incident_events (incident_id, event_type, assigned_to, author_id)
    VALUES (_incident_id, 'assignation', _assigned_to, auth.uid());
  END IF;

  IF _commentaire IS NOT NULL AND length(btrim(_commentaire)) > 0 THEN
    INSERT INTO public.incident_events (incident_id, event_type, commentaire, author_id)
    VALUES (_incident_id, 'commentaire', left(btrim(_commentaire), 4000), auth.uid());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_incident(uuid, text, uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_incident(uuid, text, uuid, text, boolean) TO authenticated;