CREATE OR REPLACE FUNCTION public.trajets_flag_recharge_seule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag boolean := false;
  v_opt text;
  v_prest text;
BEGIN
  IF NEW.devis_id IS NOT NULL THEN
    SELECT lower(coalesce(d.option_trajet, '')), lower(coalesce(d.prestation, ''))
      INTO v_opt, v_prest
      FROM public.devis d
     WHERE d.id = NEW.devis_id;

    v_flag := coalesce(
      (v_opt LIKE '%recharge%' AND (v_opt LIKE '%sans livraison%' OR v_opt LIKE '%uniquement%'))
      OR (v_prest LIKE '%recharge%' AND (v_prest LIKE '%sans livraison%' OR v_prest LIKE '%uniquement%')),
      false);
  END IF;

  IF v_flag THEN
    NEW.options_meta := coalesce(NEW.options_meta, '{}'::jsonb) || jsonb_build_object('recharge_seule', true);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trajets_flag_recharge_seule() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_trajets_flag_recharge_seule ON public.trajets;
CREATE TRIGGER trg_trajets_flag_recharge_seule
BEFORE INSERT OR UPDATE OF devis_id, options_meta ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.trajets_flag_recharge_seule();

UPDATE public.trajets t
   SET options_meta = coalesce(t.options_meta, '{}'::jsonb) || jsonb_build_object('recharge_seule', true)
  FROM public.devis d
 WHERE d.id = t.devis_id
   AND (
     (lower(coalesce(d.option_trajet, '')) LIKE '%recharge%' AND (lower(coalesce(d.option_trajet, '')) LIKE '%sans livraison%' OR lower(coalesce(d.option_trajet, '')) LIKE '%uniquement%'))
     OR (lower(coalesce(d.prestation, '')) LIKE '%recharge%' AND (lower(coalesce(d.prestation, '')) LIKE '%sans livraison%' OR lower(coalesce(d.prestation, '')) LIKE '%uniquement%'))
   );