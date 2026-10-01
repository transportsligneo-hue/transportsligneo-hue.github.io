CREATE OR REPLACE FUNCTION public.split_ar_prices(_total numeric)
 RETURNS TABLE(aller numeric, retour numeric)
 LANGUAGE plpgsql IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total numeric := round(COALESCE(_total, 0)::numeric, 2);
  v_aller numeric; v_retour numeric;
BEGIN
  IF v_total <= 0 THEN aller := 0; retour := 0; RETURN NEXT; RETURN; END IF;
  -- Forfait Tours aller-retour : 120 = 70 (livraison) + 50 (restitution)
  IF v_total = 120 THEN aller := 70; retour := 50; RETURN NEXT; RETURN; END IF;
  v_aller := ceil(v_total * 200 / 3) / 100;
  IF v_aller > v_total THEN v_aller := v_total; END IF;
  v_retour := round(v_total - v_aller, 2);
  IF v_retour < 0 THEN v_retour := 0; END IF;
  aller := v_aller; retour := v_retour; RETURN NEXT;
END;
$function$;