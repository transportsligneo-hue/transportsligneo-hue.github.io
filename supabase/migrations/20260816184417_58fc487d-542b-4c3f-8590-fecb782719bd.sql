-- Lecture directe de la table réservée aux admins
DROP POLICY IF EXISTS "Authenticated can read ai_settings" ON public.ai_settings;

DROP POLICY IF EXISTS "Admins can read ai_settings" ON public.ai_settings;
CREATE POLICY "Admins can read ai_settings"
  ON public.ai_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- RPC publique : masque model_overrides aux non-admins
CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS public.ai_settings
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.ai_settings;
BEGIN
  SELECT * INTO r FROM public.ai_settings ORDER BY created_at ASC LIMIT 1;
  IF r IS NULL THEN RETURN NULL; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    r.model_overrides := '{}'::jsonb;
  END IF;
  RETURN r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ai_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO anon, authenticated;