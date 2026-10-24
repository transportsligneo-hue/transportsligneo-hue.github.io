-- Remise à zéro des missions de test d'un compte testeur (Google Play, démo flotte, Olivier).
-- Supprime uniquement les missions marquées is_test_data liées à CE convoyeur testeur.
CREATE OR REPLACE FUNCTION public.convoyeur_reset_test_missions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
  v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_conv FROM public.convoyeurs WHERE user_id = v_uid AND is_tester = true LIMIT 1;
  IF v_conv IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT array_agg(DISTINCT a.trajet_id) INTO v_ids
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
   WHERE a.convoyeur_id = v_conv AND t.is_test_data = true;

  IF v_ids IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.attributions WHERE convoyeur_id = v_conv AND trajet_id = ANY(v_ids);
  DELETE FROM public.trajets t WHERE t.id = ANY(v_ids) AND t.is_test_data = true
    AND NOT EXISTS (SELECT 1 FROM public.attributions a WHERE a.trajet_id = t.id);

  RETURN array_length(v_ids, 1);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.convoyeur_reset_test_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convoyeur_reset_test_missions() TO authenticated;
