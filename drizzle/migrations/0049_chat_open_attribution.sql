CREATE OR REPLACE FUNCTION public.chat_open_attribution(_attribution_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid;
BEGIN
  SELECT t.mission_id INTO mid FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE a.id = _attribution_id AND (c.user_id = auth.uid() OR public.chat_is_admin(auth.uid()));
  IF mid IS NULL THEN RETURN NULL; END IF;
  RETURN public.chat_open_mission(mid, 'mission_convoyeur');
END $$;
REVOKE ALL ON FUNCTION public.chat_open_attribution(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_open_attribution(uuid) TO authenticated;