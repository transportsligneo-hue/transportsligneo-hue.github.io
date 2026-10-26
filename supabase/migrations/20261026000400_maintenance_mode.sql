-- Mode maintenance (site + application Driver) : réglage unique, lisible par tous via une fonction.
INSERT INTO public.app_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "mode": "banner", "site": true, "driver": true, "title": "Maintenance en cours", "reason": "", "return_at": null, "admin_bypass": true, "keep_tracking": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- app_settings n'est pas lisible par anon : on expose uniquement ce réglage, en lecture seule.
CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'maintenance_mode'), '{"enabled": false}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.get_maintenance_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO anon, authenticated;
