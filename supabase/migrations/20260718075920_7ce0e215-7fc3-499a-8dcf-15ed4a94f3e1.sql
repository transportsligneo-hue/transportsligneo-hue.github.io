-- Restore anon EXECUTE on globally-called display RPCs.
-- These functions expose only non-sensitive display data (public pricing display,
-- active VAT rates, AI feature flags) and are invoked from providers wrapping the
-- entire app (including public routes) before session hydration.
GRANT EXECUTE ON FUNCTION public.get_active_vat_rates() TO anon;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_pricing_display() TO anon;