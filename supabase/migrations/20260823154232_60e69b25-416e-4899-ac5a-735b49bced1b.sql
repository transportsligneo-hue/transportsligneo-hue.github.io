-- 1. Hardened anonymous public insert on b2b_transport_requests
DROP POLICY IF EXISTS "Anon can create public transport request" ON public.b2b_transport_requests;
CREATE POLICY "Anon can create public transport request"
ON public.b2b_transport_requests
FOR INSERT
TO anon
WITH CHECK (
  length(btrim(pickup_address)) BETWEEN 1 AND 500
  AND length(btrim(dropoff_address)) BETWEEN 1 AND 500
  AND company_id IS NULL
  AND organization_id IS NULL
  AND assigned_convoyeur_id IS NULL
  AND stripe_session_id IS NULL
  AND stripe_payment_intent_id IS NULL
  AND (notes IS NULL OR length(notes) <= 2000)
  AND (vehicle_type IS NULL OR length(btrim(vehicle_type)) <= 100)
  AND (urgency IS NULL OR urgency IN ('normal','urgent','flexible','express'))
  AND (scheduled_date IS NULL OR (scheduled_date >= (CURRENT_DATE - INTERVAL '1 day') AND scheduled_date <= (CURRENT_DATE + INTERVAL '2 years')))
  AND (scheduled_time IS NULL OR length(btrim(scheduled_time)) <= 20)
  AND (distance_km IS NULL OR (distance_km >= 0 AND distance_km <= 5000))
);

-- 2. Scope organization_id on companies INSERT policies
DROP POLICY IF EXISTS "Anon can create company (lead form)" ON public.companies;
CREATE POLICY "Anon can create company (lead form)"
ON public.companies
FOR INSERT
TO anon
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(btrim(contact_phone)) BETWEEN 1 AND 50
  AND organization_id IS NULL
);

DROP POLICY IF EXISTS "Users create company with own email" ON public.companies;
CREATE POLICY "Users create company with own email"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(btrim(contact_phone)) BETWEEN 1 AND 50
  AND lower(btrim(contact_email)) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  AND (organization_id IS NULL OR is_org_member(organization_id, auth.uid()))
);

-- 3. Explicitly lock margin data table to admins / internal roles only
REVOKE ALL ON public.trajets_admin_data FROM anon, authenticated;
GRANT ALL ON public.trajets_admin_data TO service_role;
