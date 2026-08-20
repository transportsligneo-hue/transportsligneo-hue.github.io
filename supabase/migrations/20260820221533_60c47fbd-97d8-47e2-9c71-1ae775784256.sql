
-- Verified email helper: returns the JWT email only when confirmed by Supabase Auth
CREATE OR REPLACE FUNCTION public.auth_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(auth.jwt() ->> 'email', ''), '') = '' THEN NULL
    WHEN COALESCE((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false)
      OR COALESCE((auth.jwt() ->> 'email_verified')::boolean, false)
      OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
      )
    THEN lower(btrim(auth.jwt() ->> 'email'))
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.auth_verified_email() FROM public;
GRANT EXECUTE ON FUNCTION public.auth_verified_email() TO authenticated, service_role;

-- companies
DROP POLICY IF EXISTS "Contacts read own company lead" ON public.companies;
CREATE POLICY "Contacts read own company lead"
ON public.companies FOR SELECT TO authenticated
USING (
  public.auth_verified_email() IS NOT NULL
  AND lower(btrim(contact_email)) = public.auth_verified_email()
);

-- client_pricing_rules
DROP POLICY IF EXISTS "Clients read own pricing" ON public.client_pricing_rules;
CREATE POLICY "Clients read own pricing"
ON public.client_pricing_rules FOR SELECT TO authenticated
USING (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
);

-- devis
DROP POLICY IF EXISTS "Clients can read own devis" ON public.devis;
CREATE POLICY "Clients can read own devis"
ON public.devis FOR SELECT TO authenticated
USING (
  (public.auth_verified_email() IS NOT NULL AND lower(btrim(email)) = public.auth_verified_email())
  OR lower(btrim(email)) IN (SELECT lower(btrim(p.email)) FROM public.profiles p WHERE p.user_id = auth.uid() AND p.email IS NOT NULL)
);

-- factures
DROP POLICY IF EXISTS "Clients read own factures" ON public.factures;
CREATE POLICY "Clients read own factures"
ON public.factures FOR SELECT TO authenticated
USING (
  (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
  OR lower(btrim(client_email)) IN (SELECT lower(btrim(p.email)) FROM public.profiles p WHERE p.user_id = auth.uid() AND p.email IS NOT NULL)
);

-- demandes_convoyage
DROP POLICY IF EXISTS "Clients can read own demandes" ON public.demandes_convoyage;
CREATE POLICY "Clients can read own demandes"
ON public.demandes_convoyage FOR SELECT TO authenticated
USING (
  (public.auth_verified_email() IS NOT NULL AND lower(btrim(email)) = public.auth_verified_email())
  OR lower(btrim(email)) IN (SELECT lower(btrim(p.email)) FROM public.profiles p WHERE p.user_id = auth.uid() AND p.email IS NOT NULL)
);

-- client_default_addresses
DROP POLICY IF EXISTS "Clients read own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients read own default addresses"
ON public.client_default_addresses FOR SELECT TO authenticated
USING (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
);

DROP POLICY IF EXISTS "Clients update own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients update own default addresses"
ON public.client_default_addresses FOR UPDATE TO authenticated
USING (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
)
WITH CHECK (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
);

DROP POLICY IF EXISTS "Clients delete own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients delete own default addresses"
ON public.client_default_addresses FOR DELETE TO authenticated
USING (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
);

DROP POLICY IF EXISTS "Clients insert own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients insert own default addresses"
ON public.client_default_addresses FOR INSERT TO authenticated
WITH CHECK (
  client_user_id = auth.uid()
  OR (public.auth_verified_email() IS NOT NULL AND lower(btrim(client_email)) = public.auth_verified_email())
);
