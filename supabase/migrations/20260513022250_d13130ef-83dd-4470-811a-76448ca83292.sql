-- Permettre aux convoyeurs de faire avancer le statut macro de leur mission
-- vers les états attendus du workflow (en_cours, en_attente_validation),
-- tout en gardant les autres champs verrouillés.
DROP POLICY IF EXISTS "Convoyeurs can update own attribution limited fields" ON public.attributions;

CREATE POLICY "Convoyeurs can update own attribution limited fields"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid())
)
WITH CHECK (
  convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid())
  AND trajet_id   = (SELECT a.trajet_id   FROM public.attributions a WHERE a.id = attributions.id)
  AND convoyeur_id = (SELECT a.convoyeur_id FROM public.attributions a WHERE a.id = attributions.id)
  AND NOT (numero_mission IS DISTINCT FROM (SELECT a.numero_mission FROM public.attributions a WHERE a.id = attributions.id))
  AND (
    -- statut inchangé
    statut = (SELECT a.statut FROM public.attributions a WHERE a.id = attributions.id)
    -- ou transition autorisée par le workflow driver
    OR (
      (SELECT a.statut FROM public.attributions a WHERE a.id = attributions.id) = 'accepte'
       AND statut = 'en_cours'
    )
    OR (
      (SELECT a.statut FROM public.attributions a WHERE a.id = attributions.id) IN ('accepte','en_cours')
       AND statut = 'en_attente_validation'
    )
  )
);