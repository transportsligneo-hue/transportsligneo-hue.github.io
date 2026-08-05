-- ============ API KEYS ============
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Clé API',
  environment text NOT NULL CHECK (environment IN ('test','live')),
  key_prefix text NOT NULL,
  key_last4 text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_org_idx ON public.api_keys(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_member_select" ON public.api_keys FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "api_keys_admin_update" ON public.api_keys FOR UPDATE TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "api_keys_admin_delete" ON public.api_keys FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============ WEBHOOK ENDPOINTS ============
CREATE TABLE public.api_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['mission.assigned','mission.started','mission.delivered','mission.cancelled','invoice.available'],
  environment text NOT NULL DEFAULT 'live' CHECK (environment IN ('test','live')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_webhook_endpoints_org_idx ON public.api_webhook_endpoints(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_webhook_endpoints TO authenticated;
GRANT ALL ON public.api_webhook_endpoints TO service_role;
ALTER TABLE public.api_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_webhooks_member_select" ON public.api_webhook_endpoints FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "api_webhooks_admin_write" ON public.api_webhook_endpoints FOR ALL TO authenticated
USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============ WEBHOOK DELIVERY LOG ============
CREATE TABLE public.api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES public.api_webhook_endpoints(id) ON DELETE SET NULL,
  event text NOT NULL,
  target_url text NOT NULL,
  mission_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt integer NOT NULL DEFAULT 1,
  status_code integer,
  success boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_webhook_deliveries_org_idx ON public.api_webhook_deliveries(organization_id, created_at DESC);

GRANT SELECT ON public.api_webhook_deliveries TO authenticated;
GRANT ALL ON public.api_webhook_deliveries TO service_role;
ALTER TABLE public.api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_webhook_deliveries_member_select" ON public.api_webhook_deliveries FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============ RATE LIMIT COUNTERS ============
CREATE TABLE public.api_rate_counters (
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);
GRANT ALL ON public.api_rate_counters TO service_role;
ALTER TABLE public.api_rate_counters ENABLE ROW LEVEL SECURITY;

-- ============ API ESTIMATES ============
CREATE TABLE public.api_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('test','live')),
  pickup_address text NOT NULL,
  delivery_address text NOT NULL,
  vehicle_type text,
  pickup_date date,
  distance_km numeric,
  price_ht numeric NOT NULL,
  price_ttc numeric NOT NULL,
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_estimates_org_idx ON public.api_estimates(organization_id, created_at DESC);

GRANT SELECT ON public.api_estimates TO authenticated;
GRANT ALL ON public.api_estimates TO service_role;
ALTER TABLE public.api_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_estimates_member_select" ON public.api_estimates FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- updated_at triggers
CREATE TRIGGER api_keys_touch BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER api_webhook_endpoints_touch BEFORE UPDATE ON public.api_webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();