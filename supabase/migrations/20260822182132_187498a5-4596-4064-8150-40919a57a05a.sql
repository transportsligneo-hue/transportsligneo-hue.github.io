
-- 1) B2B transport requests: split anon vs authenticated insert
DROP POLICY IF EXISTS "Authenticated can create own transport request" ON public.b2b_transport_requests;

CREATE POLICY "Anon can create public transport request"
ON public.b2b_transport_requests
FOR INSERT
TO anon
WITH CHECK (
  length(btrim(pickup_address)) BETWEEN 1 AND 500
  AND length(btrim(dropoff_address)) BETWEEN 1 AND 500
  AND company_id IS NULL
  AND organization_id IS NULL
);

CREATE POLICY "Authenticated can create own transport request"
ON public.b2b_transport_requests
FOR INSERT
TO authenticated
WITH CHECK (
  length(btrim(pickup_address)) BETWEEN 1 AND 500
  AND length(btrim(dropoff_address)) BETWEEN 1 AND 500
  AND (
    company_id IS NULL
    OR company_id IN (
      SELECT c.id FROM public.companies c
      WHERE auth_verified_email() IS NOT NULL
        AND lower(c.contact_email) = auth_verified_email()
    )
    OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Company contact can read own requests" ON public.b2b_transport_requests;
CREATE POLICY "Company contact can read own requests"
ON public.b2b_transport_requests
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT c.id FROM public.companies c
    WHERE auth_verified_email() IS NOT NULL
      AND lower(c.contact_email) = auth_verified_email()
  )
);

-- 2) demandes_convoyage: consolidate the two client SELECT policies
DROP POLICY IF EXISTS "Clients read demandes by user_id" ON public.demandes_convoyage;
DROP POLICY IF EXISTS "Clients can read own demandes" ON public.demandes_convoyage;

CREATE POLICY "Clients can read own demandes"
ON public.demandes_convoyage
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (auth_verified_email() IS NOT NULL AND lower(btrim(email)) = auth_verified_email())
);

-- 3) trajets: remove all anon privileges (internal margin columns)
REVOKE ALL ON public.trajets FROM anon;
