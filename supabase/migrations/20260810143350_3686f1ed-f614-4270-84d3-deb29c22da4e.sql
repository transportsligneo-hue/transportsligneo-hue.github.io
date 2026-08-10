
-- 1) Stricter driver state machine
CREATE OR REPLACE FUNCTION public.can_driver_update_attribution(_attribution_id uuid, _trajet_id uuid, _convoyeur_id uuid, _numero_mission text, _statut text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.id = _attribution_id
      AND c.user_id = auth.uid()
      AND a.trajet_id IS NOT DISTINCT FROM _trajet_id
      AND a.convoyeur_id IS NOT DISTINCT FROM _convoyeur_id
      AND a.numero_mission IS NOT DISTINCT FROM _numero_mission
      -- terminal / admin-owned states can never be changed by the driver
      AND a.statut NOT IN ('terminee','validee','annulee','refusee','en_attente_validation')
      AND (
        _statut IS NOT DISTINCT FROM a.statut
        OR (a.statut = 'propose' AND _statut IN ('accepte', 'refusee'))
        OR (a.statut = 'accepte' AND _statut = 'en_cours')
        OR (a.statut IN ('accepte', 'en_cours') AND _statut = 'en_attente_validation')
      )
  );
$function$;

-- 2) companies: authenticated users may only create companies bound to their own email
DROP POLICY IF EXISTS "Anyone can create company" ON public.companies;
CREATE POLICY "Anon can create company (lead form)"
ON public.companies FOR INSERT TO anon
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(btrim(contact_phone)) BETWEEN 1 AND 50
);
CREATE POLICY "Users create company with own email"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(contact_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_email)) BETWEEN 3 AND 254
  AND contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(btrim(contact_phone)) BETWEEN 1 AND 50
  AND lower(btrim(contact_email)) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

-- 3) mission_incidents: standardise client visibility on is_attribution_client
DROP POLICY IF EXISTS "Clients read incidents own missions" ON public.mission_incidents;
CREATE POLICY "Clients read incidents own missions"
ON public.mission_incidents FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));
