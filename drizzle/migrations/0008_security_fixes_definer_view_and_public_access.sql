-- 1. Vue des avis publiés : exécution avec les droits de l'appelant + accès réservé au serveur
ALTER VIEW public.avis_publics SET (security_invoker = on);
REVOKE ALL ON public.avis_publics FROM anon, authenticated;
GRANT SELECT ON public.avis_publics TO service_role;

-- 2. Fonctions SECURITY DEFINER : plus exécutables par le rôle anonyme
REVOKE EXECUTE ON FUNCTION public.get_public_pricing_display() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_convoyeur_invitation(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_public_pricing_display() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_convoyeur_invitation(text) TO service_role;

-- 3. Conversations de l'assistant : lecture admin uniquement, écriture serveur uniquement
REVOKE ALL ON public.assistant_conversations FROM anon, authenticated;
REVOKE ALL ON public.assistant_messages FROM anon, authenticated;
GRANT SELECT ON public.assistant_conversations TO authenticated;
GRANT SELECT ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
GRANT ALL ON public.assistant_messages TO service_role;

-- 4. Cartes grises : la mise à jour revalide toute la chaîne de propriété
DROP POLICY IF EXISTS "Clients update own carte grise" ON storage.objects;
CREATE POLICY "Clients update own carte grise"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND d.id::text = (storage.foldername(objects.name))[2]
        AND d.paid_at IS NULL
    )
  )
)
WITH CHECK (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND d.id::text = (storage.foldername(objects.name))[2]
        AND d.paid_at IS NULL
    )
  )
);

-- 5. Limitation anti-spam des formulaires publics (sociétés / demandes B2B)
CREATE OR REPLACE FUNCTION public.enforce_public_lead_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_same integer;
  recent_total integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'anon'
     AND auth.role() IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'companies' THEN
    SELECT count(*) INTO recent_same
    FROM public.companies c
    WHERE lower(btrim(c.contact_email)) = lower(btrim(NEW.contact_email))
      AND c.created_at > now() - interval '1 hour';
    IF recent_same >= 3 THEN
      RAISE EXCEPTION 'Trop de demandes envoyées depuis cette adresse email. Merci de réessayer plus tard.';
    END IF;

    SELECT count(*) INTO recent_total
    FROM public.companies c
    WHERE c.organization_id IS NULL AND c.created_at > now() - interval '5 minutes';
    IF recent_total >= 20 THEN
      RAISE EXCEPTION 'Service temporairement saturé, merci de réessayer dans quelques minutes.';
    END IF;
  ELSE
    SELECT count(*) INTO recent_total
    FROM public.b2b_transport_requests r
    WHERE r.company_id IS NULL
      AND r.organization_id IS NULL
      AND r.created_at > now() - interval '5 minutes';
    IF recent_total >= 20 THEN
      RAISE EXCEPTION 'Service temporairement saturé, merci de réessayer dans quelques minutes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_public_rate_limit ON public.companies;
CREATE TRIGGER trg_companies_public_rate_limit
BEFORE INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_public_lead_rate_limit();

DROP TRIGGER IF EXISTS trg_b2b_requests_public_rate_limit ON public.b2b_transport_requests;
CREATE TRIGGER trg_b2b_requests_public_rate_limit
BEFORE INSERT ON public.b2b_transport_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_public_lead_rate_limit();

REVOKE EXECUTE ON FUNCTION public.enforce_public_lead_rate_limit() FROM anon, public;