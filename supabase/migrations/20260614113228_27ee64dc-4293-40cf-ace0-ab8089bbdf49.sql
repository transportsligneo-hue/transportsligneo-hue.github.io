CREATE OR REPLACE FUNCTION public.is_mission_client(_user_id uuid, _mission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.missions m
    LEFT JOIN public.profiles p ON p.user_id = _user_id
    LEFT JOIN public.organization_members om ON om.user_id = _user_id AND om.status = 'active'
    WHERE m.id = _mission_id
      AND (
        m.user_id = _user_id
        OR (p.email IS NOT NULL AND lower(p.email) = lower(coalesce(m.email, '')))
        OR (m.organization_id IS NOT NULL AND om.organization_id = m.organization_id)
        OR (m.fleet_organization_id IS NOT NULL AND om.organization_id = m.fleet_organization_id)
        OR (p.organization_id IS NOT NULL AND (p.organization_id = m.organization_id OR p.organization_id = m.fleet_organization_id))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_mission_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mission_client(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can read own missions" ON public.missions;
DROP POLICY IF EXISTS "Org members can read organization missions" ON public.missions;
CREATE POLICY "Users can read own missions"
ON public.missions
FOR SELECT TO authenticated
USING (public.is_mission_client(auth.uid(), id));

CREATE POLICY "Org members can read organization missions"
ON public.missions
FOR SELECT TO authenticated
USING (public.is_mission_client(auth.uid(), id));

DROP POLICY IF EXISTS "Clients read own attributions" ON public.attributions;
CREATE POLICY "Clients read own attributions"
ON public.attributions
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), id));

DROP POLICY IF EXISTS "Clients read own trajets" ON public.trajets;
CREATE POLICY "Clients read own trajets"
ON public.trajets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.attributions a
    WHERE a.trajet_id = trajets.id
      AND public.is_attribution_client(auth.uid(), a.id)
  )
);

DROP POLICY IF EXISTS "Clients read cartes grises of own missions" ON storage.objects;
CREATE POLICY "Clients read cartes grises of own missions"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND EXISTS (
    SELECT 1
    FROM public.trajets t
    JOIN public.attributions a ON a.trajet_id = t.id
    WHERE (t.carte_grise_recto_url = storage.objects.name OR t.carte_grise_verso_url = storage.objects.name)
      AND public.is_attribution_client(auth.uid(), a.id)
  )
);