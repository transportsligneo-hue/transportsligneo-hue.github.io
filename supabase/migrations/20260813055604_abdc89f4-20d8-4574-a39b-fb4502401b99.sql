-- 1) B2B: remove direct anon table INSERT (public form uses the validated, rate-limited RPC)
DROP POLICY IF EXISTS "Public can create transport request" ON public.b2b_transport_requests;
REVOKE INSERT ON public.b2b_transport_requests FROM anon;

-- 2) pricing_settings: no broad public row read; expose only via the dedicated function
DROP POLICY IF EXISTS "Public can read billing regime" ON public.pricing_settings;
REVOKE SELECT ON public.pricing_settings FROM anon;

GRANT EXECUTE ON FUNCTION public.get_public_pricing_display() TO anon, authenticated;