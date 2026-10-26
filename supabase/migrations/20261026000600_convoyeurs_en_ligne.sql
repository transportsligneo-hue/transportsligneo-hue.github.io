-- Convoyeurs en ligne : chaque appli Driver ouverte envoie un signal toutes les 30 s
-- (dernière activité, version de l'appli, position si le téléphone l'autorise déjà).
-- L'admin voit qui est en ligne (signal de moins de 90 s), libre ou en mission.
-- Sans risque : peut être relancé plusieurs fois.

CREATE TABLE IF NOT EXISTS public.convoyeur_presence (
  user_id uuid PRIMARY KEY,
  convoyeur_id uuid,
  last_seen timestamptz NOT NULL DEFAULT now(),
  online_since timestamptz NOT NULL DEFAULT now(),
  app_version text,
  is_native boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  position_at timestamptz
);
CREATE INDEX IF NOT EXISTS convoyeur_presence_last_seen ON public.convoyeur_presence (last_seen DESC);

ALTER TABLE public.convoyeur_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presence_admin_read" ON public.convoyeur_presence;
CREATE POLICY "presence_admin_read" ON public.convoyeur_presence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "presence_self_read" ON public.convoyeur_presence;
CREATE POLICY "presence_self_read" ON public.convoyeur_presence FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.convoyeur_presence TO authenticated;

-- Signal envoyé par l'appli : écrit uniquement la ligne du convoyeur connecté.
CREATE OR REPLACE FUNCTION public.driver_heartbeat(p_version text, p_native boolean, p_lat double precision, p_lng double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cid uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT id INTO v_cid FROM public.convoyeurs WHERE user_id = v_uid LIMIT 1;
  IF v_cid IS NULL THEN RETURN; END IF; -- seulement les comptes convoyeurs
  INSERT INTO public.convoyeur_presence AS p (user_id, convoyeur_id, last_seen, online_since, app_version, is_native, latitude, longitude, position_at)
  VALUES (v_uid, v_cid, now(), now(), left(p_version, 20), coalesce(p_native,false), p_lat, p_lng, CASE WHEN p_lat IS NOT NULL THEN now() END)
  ON CONFLICT (user_id) DO UPDATE SET
    convoyeur_id = EXCLUDED.convoyeur_id,
    -- revenu après plus de 3 min sans signal = nouvelle connexion
    online_since = CASE WHEN p.last_seen < now() - interval '3 minutes' THEN now() ELSE p.online_since END,
    last_seen = now(),
    app_version = coalesce(EXCLUDED.app_version, p.app_version),
    is_native = EXCLUDED.is_native,
    latitude = coalesce(EXCLUDED.latitude, p.latitude),
    longitude = coalesce(EXCLUDED.longitude, p.longitude),
    position_at = coalesce(EXCLUDED.position_at, p.position_at);
END $$;
REVOKE ALL ON FUNCTION public.driver_heartbeat(text, boolean, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_heartbeat(text, boolean, double precision, double precision) TO authenticated;

-- Mise à jour en direct dans l'admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'convoyeur_presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.convoyeur_presence;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
