CREATE OR REPLACE FUNCTION public.enforce_public_lead_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_same integer;
  recent_total integer;
  v_fp text;
  v_row public.public_tracking_attempts%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'companies' THEN
    v_fp := 'lead:companies:' || lower(btrim(COALESCE(NEW.contact_email, 'unknown')));

    SELECT count(*) INTO recent_same
    FROM public.companies c
    WHERE lower(btrim(c.contact_email)) = lower(btrim(NEW.contact_email))
      AND c.created_at > now() - interval '1 hour';
    IF recent_same >= 3 THEN
      RAISE EXCEPTION 'Trop de demandes envoyées depuis cette adresse email. Merci de réessayer plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) INTO recent_total
    FROM public.companies c
    WHERE c.organization_id IS NULL AND c.created_at > now() - interval '5 minutes';
    IF recent_total >= 20 THEN
      RAISE EXCEPTION 'Service temporairement saturé, merci de réessayer dans quelques minutes.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_fp := 'lead:b2b:' || lower(btrim(COALESCE(NEW.pickup_address, 'unknown')));

    SELECT count(*) INTO recent_total
    FROM public.b2b_transport_requests r
    WHERE r.company_id IS NULL
      AND r.organization_id IS NULL
      AND r.created_at > now() - interval '5 minutes';
    IF recent_total >= 20 THEN
      RAISE EXCEPTION 'Service temporairement saturé, merci de réessayer dans quelques minutes.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.public_tracking_attempts
  WHERE fingerprint = v_fp
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.public_tracking_attempts (fingerprint, failed_count, window_started_at)
    VALUES (v_fp, 1, now())
    ON CONFLICT (fingerprint) DO UPDATE SET failed_count = public.public_tracking_attempts.failed_count + 1, updated_at = now();
    RETURN NEW;
  END IF;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > now() THEN
    RAISE EXCEPTION 'Trop de demandes envoyées récemment. Merci de réessayer plus tard.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_row.window_started_at < now() - interval '1 hour' THEN
    UPDATE public.public_tracking_attempts
       SET failed_count = 1, window_started_at = now(), blocked_until = NULL, updated_at = now()
     WHERE id = v_row.id;
  ELSIF v_row.failed_count >= 5 THEN
    UPDATE public.public_tracking_attempts
       SET blocked_until = now() + interval '1 hour', updated_at = now()
     WHERE id = v_row.id;
    RAISE EXCEPTION 'Trop de demandes envoyées récemment. Merci de réessayer plus tard.'
      USING ERRCODE = 'check_violation';
  ELSE
    UPDATE public.public_tracking_attempts
       SET failed_count = v_row.failed_count + 1, updated_at = now()
     WHERE id = v_row.id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_public_lead_rate_limit() FROM PUBLIC, anon, authenticated;