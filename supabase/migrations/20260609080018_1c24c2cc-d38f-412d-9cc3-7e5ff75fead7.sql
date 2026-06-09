
DROP POLICY IF EXISTS "Convoyeurs read assigned cartes grises" ON storage.objects;
CREATE POLICY "Convoyeurs read assigned cartes grises"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND (
    EXISTS (
      SELECT 1
      FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      JOIN public.trajets t ON t.id = a.trajet_id
      JOIN public.devis d ON d.id = t.devis_id
      WHERE c.user_id = auth.uid()
        AND a.statut = ANY (ARRAY['accepte','en_cours','terminee'])
        AND (d.user_id)::text = (storage.foldername(objects.name))[1]
    )
    OR EXISTS (
      SELECT 1
      FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      JOIN public.trajets t ON t.id = a.trajet_id
      JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
      WHERE c.user_id = auth.uid()
        AND a.statut = ANY (ARRAY['accepte','en_cours','terminee'])
        AND (dc.user_id)::text = (storage.foldername(objects.name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Clients read own mission inspection photos" ON public.inspection_photos;
CREATE POLICY "Clients read own mission inspection photos"
ON public.inspection_photos
FOR SELECT
TO authenticated
USING (
  inspection_id IN (
    SELECT i.id
    FROM public.inspections i
    JOIN public.attributions a ON a.id = i.attribution_id
    JOIN public.trajets t ON t.id = a.trajet_id
    LEFT JOIN public.devis d ON d.id = t.devis_id
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    WHERE d.user_id = auth.uid() OR dc.user_id = auth.uid()
  )
);

ALTER VIEW public.trajets_assigned_safe SET (security_invoker = on);

DROP POLICY IF EXISTS "Convoyeurs read assigned trajets" ON public.trajets;
CREATE POLICY "Convoyeurs read assigned trajets"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.trajet_id = trajets.id
      AND c.user_id = auth.uid()
  )
);
