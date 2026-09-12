CREATE OR REPLACE FUNCTION public.validate_anon_b2b_transport_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    IF NEW.pickup_address IS NULL OR length(btrim(NEW.pickup_address)) < 3 OR length(NEW.pickup_address) > 500 THEN
      RAISE EXCEPTION 'Adresse de départ invalide.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.dropoff_address IS NULL OR length(btrim(NEW.dropoff_address)) < 3 OR length(NEW.dropoff_address) > 500 THEN
      RAISE EXCEPTION 'Adresse de livraison invalide.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.validate_anon_b2b_transport_input() FROM anon, authenticated;