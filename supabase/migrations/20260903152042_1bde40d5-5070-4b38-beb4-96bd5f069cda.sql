-- Restrict loyalty tier configuration to admins only
DROP POLICY IF EXISTS "Authenticated users can read km tiers" ON public.km_tiers;

-- Defensive hardening: ensure anonymous visitors can never read lead contact data
REVOKE SELECT ON public.companies FROM anon;
GRANT INSERT ON public.companies TO anon;

-- Defensive hardening: app settings remain fail-closed via allow-list
REVOKE SELECT ON public.app_settings FROM anon;