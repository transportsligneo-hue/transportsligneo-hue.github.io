
REVOKE ALL ON TABLE public.api_internal_config FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.api_internal_config TO service_role;

CREATE OR REPLACE FUNCTION public.validate_anon_companies_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF NEW.contact_email IS NULL
       OR NEW.contact_email !~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
       OR length(NEW.contact_email) > 255 THEN
      RAISE EXCEPTION 'Adresse email invalide.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.name IS NULL OR length(btrim(NEW.name)) < 2 OR length(NEW.name) > 200 THEN
      RAISE EXCEPTION 'Nom de société invalide.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.organization_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_anon_companies_input ON public.companies;
CREATE TRIGGER trg_validate_anon_companies_input
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.validate_anon_companies_input();

CREATE OR REPLACE FUNCTION public.validate_anon_b2b_transport_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF NEW.contact_email IS NULL
       OR NEW.contact_email !~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
       OR length(NEW.contact_email) > 255 THEN
      RAISE EXCEPTION 'Adresse email invalide.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.pickup_address IS NULL OR length(btrim(NEW.pickup_address)) < 3 OR length(NEW.pickup_address) > 500 THEN
      RAISE EXCEPTION 'Adresse de départ invalide.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.delivery_address IS NULL OR length(btrim(NEW.delivery_address)) < 3 OR length(NEW.delivery_address) > 500 THEN
      RAISE EXCEPTION 'Adresse de livraison invalide.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_anon_b2b_transport_input ON public.b2b_transport_requests;
CREATE TRIGGER trg_validate_anon_b2b_transport_input
BEFORE INSERT ON public.b2b_transport_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_anon_b2b_transport_input();
