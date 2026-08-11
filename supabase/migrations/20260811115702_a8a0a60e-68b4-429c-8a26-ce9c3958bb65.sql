CREATE OR REPLACE FUNCTION public.admin_rename_mission_numero(_attribution_id uuid, _numero text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num text := btrim(_numero);
  v_trajet uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF v_num IS NULL OR v_num = '' THEN
    RAISE EXCEPTION 'Numéro requis';
  END IF;
  IF v_num !~ '^[A-Za-z0-9 #._/-]+$' THEN
    RAISE EXCEPTION 'Caractères non autorisés';
  END IF;

  SELECT trajet_id INTO v_trajet FROM public.attributions WHERE id = _attribution_id;
  IF v_trajet IS NULL AND NOT EXISTS (SELECT 1 FROM public.attributions WHERE id = _attribution_id) THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  UPDATE public.attributions SET numero_mission = v_num WHERE id = _attribution_id;

  IF v_trajet IS NOT NULL THEN
    UPDATE public.trajets SET numero_mission = v_num WHERE id = v_trajet;
    UPDATE public.attributions SET numero_mission = v_num
      WHERE trajet_id = v_trajet AND id <> _attribution_id;
  END IF;

  RETURN v_num;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rename_mission_numero(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rename_mission_numero(uuid, text) TO authenticated;