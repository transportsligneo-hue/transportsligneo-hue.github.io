
-- 1) SECURITY DEFINER VIEW -> switch to security_invoker
ALTER VIEW public.trajets_publies_safe SET (security_invoker = true);

-- 2) verify_certificate: revoke anon EXECUTE (will be called via server fn using admin)
REVOKE EXECUTE ON FUNCTION public.verify_certificate(uuid) FROM anon, PUBLIC;

-- 3) Storage policies: rescope from {public} to {authenticated}
DROP POLICY IF EXISTS "Clients delete own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients update own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients upload own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;

CREATE POLICY "Clients delete own carte grise" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cartes-grises'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND (d.id)::text = (storage.foldername(objects.name))[2]
        AND d.paid_at IS NULL
    )
  );

CREATE POLICY "Clients read own carte grise" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cartes-grises'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients update own carte grise" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cartes-grises'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND (d.id)::text = (storage.foldername(objects.name))[2]
        AND d.paid_at IS NULL
    )
  )
  WITH CHECK (
    bucket_id = 'cartes-grises'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients upload own carte grise" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cartes-grises'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4) Rate limit anon inserts on companies + b2b_transport_requests + b2b_fleet_leads
CREATE OR REPLACE FUNCTION public.enforce_anon_companies_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  IF auth.uid() IS NULL THEN
    SELECT count(*) INTO recent FROM public.companies
     WHERE lower(contact_email) = lower(NEW.contact_email)
       AND created_at > now() - interval '1 hour';
    IF recent >= 3 THEN
      RAISE EXCEPTION 'Trop de soumissions récentes pour cette adresse email. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO recent FROM public.companies
     WHERE created_at > now() - interval '10 minutes';
    IF recent >= 30 THEN
      RAISE EXCEPTION 'Trop de créations anonymes récentes. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_enforce_anon_companies_rl ON public.companies;
CREATE TRIGGER trg_enforce_anon_companies_rl
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_companies_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_anon_b2b_transport_rl()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  IF auth.uid() IS NULL THEN
    SELECT count(*) INTO recent FROM public.b2b_transport_requests
     WHERE created_at > now() - interval '1 hour'
       AND (company_id IS NOT DISTINCT FROM NEW.company_id);
    IF recent >= 5 THEN
      RAISE EXCEPTION 'Trop de demandes récentes. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO recent FROM public.b2b_transport_requests
     WHERE created_at > now() - interval '10 minutes';
    IF recent >= 30 THEN
      RAISE EXCEPTION 'Trop de demandes anonymes récentes. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_enforce_anon_b2b_tr_rl ON public.b2b_transport_requests;
CREATE TRIGGER trg_enforce_anon_b2b_tr_rl
BEFORE INSERT ON public.b2b_transport_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_b2b_transport_rl();

CREATE OR REPLACE FUNCTION public.enforce_anon_b2b_fleet_rl()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  IF auth.uid() IS NULL THEN
    SELECT count(*) INTO recent FROM public.b2b_fleet_leads
     WHERE created_at > now() - interval '1 hour'
       AND (company_id IS NOT DISTINCT FROM NEW.company_id);
    IF recent >= 5 THEN
      RAISE EXCEPTION 'Trop de demandes récentes. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO recent FROM public.b2b_fleet_leads
     WHERE created_at > now() - interval '10 minutes';
    IF recent >= 30 THEN
      RAISE EXCEPTION 'Trop de demandes anonymes récentes. Réessayez plus tard.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_enforce_anon_b2b_fleet_rl ON public.b2b_fleet_leads;
CREATE TRIGGER trg_enforce_anon_b2b_fleet_rl
BEFORE INSERT ON public.b2b_fleet_leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_b2b_fleet_rl();

-- 5) Protect sensitive convoyeurs fields on self-update
CREATE OR REPLACE FUNCTION public.protect_convoyeur_sensitive_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    NEW.statut := OLD.statut;
    NEW.account_status := OLD.account_status;
    NEW.training_status := OLD.training_status;
    NEW.has_completed_training := OLD.has_completed_training;
    NEW.training_completed_at := OLD.training_completed_at;
    NEW.user_id := OLD.user_id;
    NEW.organization_id := OLD.organization_id;
    NEW.type_convoyeur := OLD.type_convoyeur;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_protect_convoyeur_sensitive ON public.convoyeurs;
CREATE TRIGGER trg_protect_convoyeur_sensitive
BEFORE UPDATE ON public.convoyeurs
FOR EACH ROW EXECUTE FUNCTION public.protect_convoyeur_sensitive_fields();

-- 6) Realtime broadcast: scope to admin: topic prefix
DROP POLICY IF EXISTS "Admins can read realtime broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can send realtime broadcast" ON realtime.messages;

CREATE POLICY "Admins can read admin broadcast topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (realtime.topic() LIKE 'admin:%' OR realtime.topic() LIKE 'admin-%')
  );

CREATE POLICY "Admins can send admin broadcast topics" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (realtime.topic() LIKE 'admin:%' OR realtime.topic() LIKE 'admin-%')
  );
