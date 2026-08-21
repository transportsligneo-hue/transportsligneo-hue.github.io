DROP POLICY IF EXISTS "Clients read missions by email" ON public.missions;
CREATE POLICY "Clients read missions by email"
ON public.missions FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (public.auth_verified_email() IS NOT NULL AND lower(email) = public.auth_verified_email())
);

DROP POLICY IF EXISTS "Client read own acceptations" ON public.devis_acceptations;
CREATE POLICY "Client read own acceptations"
ON public.devis_acceptations FOR SELECT
USING (
  (client_user_id = auth.uid())
  OR (public.auth_verified_email() IS NOT NULL AND lower(client_email) = public.auth_verified_email())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Client insert own acceptation" ON public.devis_acceptations;
CREATE POLICY "Client insert own acceptation"
ON public.devis_acceptations FOR INSERT
WITH CHECK (
  (
    (client_user_id = auth.uid())
    OR (public.auth_verified_email() IS NOT NULL AND lower(client_email) = public.auth_verified_email())
  )
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = devis_acceptations.devis_id
      AND (
        d.user_id = auth.uid()
        OR (public.auth_verified_email() IS NOT NULL AND lower(COALESCE(d.email, '')) = public.auth_verified_email())
      )
  )
);

DROP POLICY IF EXISTS "Company contact can read own requests" ON public.b2b_transport_requests;
CREATE POLICY "Company contact can read own requests"
ON public.b2b_transport_requests FOR SELECT
USING (
  company_id IN (
    SELECT c.id FROM public.companies c
    WHERE public.auth_verified_email() IS NOT NULL
      AND lower(c.contact_email) = public.auth_verified_email()
  )
);

DROP POLICY IF EXISTS "Authenticated can create own transport request" ON public.b2b_transport_requests;
CREATE POLICY "Authenticated can create own transport request"
ON public.b2b_transport_requests FOR INSERT
WITH CHECK (
  (length(btrim(pickup_address)) >= 1 AND length(btrim(pickup_address)) <= 500)
  AND (length(btrim(dropoff_address)) >= 1 AND length(btrim(dropoff_address)) <= 500)
  AND (
    company_id IS NULL
    OR company_id IN (
      SELECT c.id FROM public.companies c
      WHERE public.auth_verified_email() IS NOT NULL
        AND lower(c.contact_email) = public.auth_verified_email()
    )
    OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
  )
);