-- 1. Lock down log_activity to admins or service_role only
CREATE OR REPLACE FUNCTION public.log_activity(_action text, _entity_type text, _entity_id uuid DEFAULT NULL::uuid, _organization_id uuid DEFAULT NULL::uuid, _metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.activity_logs (actor_user_id, action, entity_type, entity_id, organization_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _organization_id, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, uuid, jsonb) TO service_role;

-- 2. Remove direct base-table access for convoyeurs to trajets — they must go through trajets_publies_safe view
DROP POLICY IF EXISTS "Convoyeurs read published trajets via safe view" ON public.trajets;

-- 3. Tighten attributions update policy: prevent convoyeurs from mutating privileged fields
DROP POLICY IF EXISTS "Convoyeurs can update own attribution status" ON public.attributions;

CREATE POLICY "Convoyeurs can update own attribution limited fields"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid())
  AND statut = (SELECT a.statut FROM public.attributions a WHERE a.id = attributions.id)
  AND numero_mission IS NOT DISTINCT FROM (SELECT a.numero_mission FROM public.attributions a WHERE a.id = attributions.id)
  AND trajet_id = (SELECT a.trajet_id FROM public.attributions a WHERE a.id = attributions.id)
  AND convoyeur_id = (SELECT a.convoyeur_id FROM public.attributions a WHERE a.id = attributions.id)
);