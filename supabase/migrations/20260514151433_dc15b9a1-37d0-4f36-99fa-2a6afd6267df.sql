CREATE OR REPLACE FUNCTION public.can_driver_update_attribution(
  _attribution_id uuid,
  _trajet_id uuid,
  _convoyeur_id uuid,
  _numero_mission text,
  _statut text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.id = _attribution_id
      AND c.user_id = auth.uid()
      AND a.trajet_id IS NOT DISTINCT FROM _trajet_id
      AND a.convoyeur_id IS NOT DISTINCT FROM _convoyeur_id
      AND a.numero_mission IS NOT DISTINCT FROM _numero_mission
      AND (
        _statut IS NOT DISTINCT FROM a.statut
        OR (a.statut = 'propose' AND _statut IN ('accepte', 'refusee'))
        OR (a.statut = 'accepte' AND _statut = 'en_cours')
        OR (a.statut IN ('accepte', 'en_cours') AND _statut = 'en_attente_validation')
      )
  );
$$;

DROP POLICY IF EXISTS "Convoyeurs can update own attribution status" ON public.attributions;
DROP POLICY IF EXISTS "Convoyeurs can update own attribution limited fields" ON public.attributions;

CREATE POLICY "Convoyeurs can update own attribution limited fields"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  convoyeur_id IN (
    SELECT c.id
    FROM public.convoyeurs c
    WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  public.can_driver_update_attribution(
    id,
    trajet_id,
    convoyeur_id,
    numero_mission,
    statut
  )
);