-- 1) Anti-abuse durci pour les insertions anonymes (companies + b2b_transport_requests)
--    Compteur persistant par empreinte dans public_tracking_attempts.
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
  -- Seules les soumissions anonymes sont limitées
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
    v_fp := 'lead:b2b:' || lower(btrim(COALESCE(NEW.contact_email, NEW.pickup_address, 'unknown')));

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

  -- Compteur persistant : 5 soumissions / heure par empreinte, blocage 1 h au-delà
  SELECT * INTO v_row
  FROM public.public_tracking_attempts
  WHERE fingerprint = v_fp
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.public_tracking_attempts (fingerprint, failed_count, window_started_at)
    VALUES (v_fp, 1, now());
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

CREATE UNIQUE INDEX IF NOT EXISTS public_tracking_attempts_fingerprint_key
  ON public.public_tracking_attempts (fingerprint);

-- 2) OTP : lecture réservée aux super-admins (plus aucun admin standard)
DROP POLICY IF EXISTS "Admins see all OTP challenges" ON public.devis_otp_challenges;
CREATE POLICY "Super admins see OTP challenges"
  ON public.devis_otp_challenges
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

REVOKE ALL ON public.devis_otp_challenges FROM anon, authenticated;
GRANT SELECT ON public.devis_otp_challenges TO authenticated;
GRANT ALL ON public.devis_otp_challenges TO service_role;

-- 3) Compteurs anti-abus : écriture strictement réservée au code serveur de confiance
REVOKE ALL ON public.public_tracking_attempts FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.public_tracking_attempts TO authenticated;
GRANT ALL ON public.public_tracking_attempts TO service_role;

DROP POLICY IF EXISTS "No client writes on tracking attempts" ON public.public_tracking_attempts;
CREATE POLICY "No client writes on tracking attempts"
  ON public.public_tracking_attempts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);