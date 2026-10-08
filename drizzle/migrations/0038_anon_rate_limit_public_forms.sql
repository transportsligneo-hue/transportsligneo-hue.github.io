CREATE OR REPLACE FUNCTION public.enforce_anon_public_form_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE recent int; per_email int := COALESCE(TG_ARGV[0]::int, 10);
BEGIN
  IF auth.uid() IS NULL THEN
    EXECUTE format('SELECT count(*) FROM public.%I WHERE lower(email) = lower($1) AND created_at > now() - interval ''1 hour''', TG_TABLE_NAME)
      INTO recent USING NEW.email;
    IF recent >= per_email THEN
      RAISE EXCEPTION 'Trop de demandes récentes pour cette adresse email. Réessayez plus tard.' USING ERRCODE = 'check_violation';
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at > now() - interval ''10 minutes''', TG_TABLE_NAME) INTO recent;
    IF recent >= 60 THEN
      RAISE EXCEPTION 'Trop de demandes en ce moment. Réessayez dans quelques minutes.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;$fn$;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_public_form_rate_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_anon_rl_contact_messages BEFORE INSERT ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_public_form_rate_limit('5');
CREATE TRIGGER trg_anon_rl_demandes BEFORE INSERT ON public.demandes_convoyage FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_public_form_rate_limit('10');
CREATE TRIGGER trg_anon_rl_devis BEFORE INSERT ON public.devis FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_public_form_rate_limit('10');