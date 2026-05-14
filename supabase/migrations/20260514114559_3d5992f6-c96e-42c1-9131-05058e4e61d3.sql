DROP POLICY IF EXISTS "Convoyeurs valides voient trajets publies" ON public.trajets;
DROP POLICY IF EXISTS "Convoyeurs read published trajets via safe view" ON public.trajets;

CREATE POLICY "Convoyeurs valides voient trajets publies"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND public.is_validated_convoyeur(auth.uid())
);

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
  convoyeur_id IN (
    SELECT c.id
    FROM public.convoyeurs c
    WHERE c.user_id = auth.uid()
  )
  AND trajet_id = (
    SELECT a.trajet_id
    FROM public.attributions a
    WHERE a.id = attributions.id
  )
  AND convoyeur_id = (
    SELECT a.convoyeur_id
    FROM public.attributions a
    WHERE a.id = attributions.id
  )
  AND NOT (
    numero_mission IS DISTINCT FROM (
      SELECT a.numero_mission
      FROM public.attributions a
      WHERE a.id = attributions.id
    )
  )
  AND (
    statut = (
      SELECT a.statut
      FROM public.attributions a
      WHERE a.id = attributions.id
    )
    OR (
      (
        SELECT a.statut
        FROM public.attributions a
        WHERE a.id = attributions.id
      ) = 'propose'
      AND statut IN ('accepte', 'refusee')
    )
    OR (
      (
        SELECT a.statut
        FROM public.attributions a
        WHERE a.id = attributions.id
      ) = 'accepte'
      AND statut = 'en_cours'
    )
    OR (
      (
        SELECT a.statut
        FROM public.attributions a
        WHERE a.id = attributions.id
      ) IN ('accepte', 'en_cours')
      AND statut = 'en_attente_validation'
    )
  )
);