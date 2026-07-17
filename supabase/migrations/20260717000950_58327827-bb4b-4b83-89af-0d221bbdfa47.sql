
-- ========== 1. Extension du RPC admin_create_test_mission (target convoyeur) ==========
CREATE OR REPLACE FUNCTION public.admin_create_test_mission(_target_convoyeur_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_convoyeur_id uuid := _target_convoyeur_id;
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
    'en_attente',
    CASE WHEN v_convoyeur_id IS NULL THEN 'publie' ELSE 'brouillon' END,
    CASE WHEN v_convoyeur_id IS NULL THEN 'catalogue' ELSE 'direct' END,
    true
  )
  RETURNING id INTO v_id;

  -- Si convoyeur cible fourni, créer une attribution 'directe' en attente convoyeur
  IF v_convoyeur_id IS NOT NULL THEN
    INSERT INTO public.attributions (
      trajet_id, convoyeur_id, mode, statut, statut_convoyeur, propose_at
    ) VALUES (
      v_id, v_convoyeur_id, 'directe', 'proposee', 'en_attente', now()
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_test_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_test_mission(uuid) TO authenticated;

-- ========== 2. Tables handoff QR scan PC↔mobile ==========
CREATE TABLE IF NOT EXISTS public.scan_handoff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  short_code text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context text NOT NULL DEFAULT 'admin_mission',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_handoff_sessions_token ON public.scan_handoff_sessions(token);
CREATE INDEX IF NOT EXISTS idx_scan_handoff_sessions_created_by ON public.scan_handoff_sessions(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_handoff_sessions TO authenticated;
GRANT ALL ON public.scan_handoff_sessions TO service_role;

ALTER TABLE public.scan_handoff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own handoff sessions"
  ON public.scan_handoff_sessions FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Owner deletes own handoff sessions"
  ON public.scan_handoff_sessions FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.scan_handoff_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.scan_handoff_sessions(id) ON DELETE CASCADE,
  extraction jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_handoff_extractions_session ON public.scan_handoff_extractions(session_id);

GRANT SELECT ON public.scan_handoff_extractions TO authenticated;
GRANT ALL ON public.scan_handoff_extractions TO service_role;

ALTER TABLE public.scan_handoff_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads extractions of own sessions"
  ON public.scan_handoff_extractions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scan_handoff_sessions s
      WHERE s.id = session_id AND s.created_by = auth.uid()
    )
  );

-- Realtime pour recevoir les extractions dans la modal PC
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_handoff_extractions;

-- ========== 3. Fonctions serveur pour créer / consommer une session handoff ==========

-- Créer une session (admin/authenticated user)
CREATE OR REPLACE FUNCTION public.create_scan_handoff_session(_context text DEFAULT 'admin_mission')
RETURNS TABLE (id uuid, token text, short_code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_short text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Purge des sessions expirées (best effort)
  DELETE FROM public.scan_handoff_sessions
   WHERE expires_at < now() - interval '1 hour';

  v_token := replace(encode(gen_random_bytes(24), 'base64'), '/', '_');
  v_token := replace(v_token, '+', '-');
  v_token := replace(v_token, '=', '');
  v_short := upper(substring(md5(v_token || clock_timestamp()::text), 1, 6));
  v_expires := now() + interval '10 minutes';

  INSERT INTO public.scan_handoff_sessions (token, short_code, created_by, context, expires_at)
  VALUES (v_token, v_short, v_uid, _context, v_expires)
  RETURNING scan_handoff_sessions.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token, v_short, v_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_scan_handoff_session(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_scan_handoff_session(text) TO authenticated;

-- Résoudre un token (page mobile publique) — renvoie juste si valide + contexte
CREATE OR REPLACE FUNCTION public.resolve_scan_handoff_token(_token text)
RETURNS TABLE (session_id uuid, context text, expires_at timestamptz, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.context, s.expires_at, s.status
    FROM public.scan_handoff_sessions s
   WHERE s.token = _token
     AND s.expires_at > now()
   LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) TO anon, authenticated;

-- Pousser une extraction depuis le mobile (via token, sans authentification)
CREATE OR REPLACE FUNCTION public.push_scan_handoff_extraction(_token text, _extraction jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
  v_expires timestamptz;
  v_count int;
  v_extraction_id uuid;
BEGIN
  SELECT id, expires_at INTO v_session_id, v_expires
    FROM public.scan_handoff_sessions
   WHERE token = _token
   LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = '42704';
  END IF;
  IF v_expires < now() THEN
    RAISE EXCEPTION 'session_expired' USING ERRCODE = '22023';
  END IF;

  -- Rate limit : 25 pages max par session
  SELECT count(*) INTO v_count
    FROM public.scan_handoff_extractions WHERE session_id = v_session_id;
  IF v_count >= 25 THEN
    RAISE EXCEPTION 'too_many_extractions' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.scan_handoff_extractions (session_id, extraction)
  VALUES (v_session_id, _extraction)
  RETURNING id INTO v_extraction_id;

  UPDATE public.scan_handoff_sessions
     SET status = 'scanning'
   WHERE id = v_session_id AND status = 'pending';

  RETURN v_extraction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.push_scan_handoff_extraction(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.push_scan_handoff_extraction(text, jsonb) TO anon, authenticated;
