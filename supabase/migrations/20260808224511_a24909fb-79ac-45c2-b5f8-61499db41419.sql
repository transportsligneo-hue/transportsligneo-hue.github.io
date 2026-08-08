-- 1) search_path figé
CREATE OR REPLACE FUNCTION public.convoyeur_level_rank(_n text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_n,'debutant'))
    WHEN 'expert' THEN 3 WHEN 'confirme' THEN 2 ELSE 1 END;
$function$;

-- 2) ai_settings : suppression de la lecture anonyme directe (doublon), lecture publique via RPC
DROP POLICY IF EXISTS "Public reads ai_settings" ON public.ai_settings;
REVOKE SELECT ON public.ai_settings FROM anon;

CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS public.ai_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.ai_settings ORDER BY created_at ASC LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO anon, authenticated;

-- 3) pricing_settings : plus de lecture directe de la ligne, uniquement les 3 champs publics via RPC
DROP POLICY IF EXISTS "Public reads pricing display" ON public.pricing_settings;
REVOKE SELECT ON public.pricing_settings FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_pricing_display()
RETURNS TABLE(regime text, default_vat_rate numeric, currency text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT regime, default_vat_rate, currency
  FROM public.pricing_settings
  WHERE id = true
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_pricing_display() TO anon, authenticated;

-- 4) b2b_transport_requests : insertion anonyme sans rattachement société/organisation forgeable
DROP POLICY IF EXISTS "Public can create transport request" ON public.b2b_transport_requests;
CREATE POLICY "Public can create transport request"
ON public.b2b_transport_requests FOR INSERT TO anon
WITH CHECK (
  length(btrim(pickup_address)) BETWEEN 1 AND 500
  AND length(btrim(dropoff_address)) BETWEEN 1 AND 500
  AND organization_id IS NULL
  AND assigned_convoyeur_id IS NULL
);

-- 5) documents_convoyeurs : verrouillage explicite des modifications par les convoyeurs
CREATE POLICY "Convoyeurs cannot update documents"
ON public.documents_convoyeurs FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));