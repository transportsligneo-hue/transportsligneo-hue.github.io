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
        AND (d.id)::text = (storage.foldername(objects.name))[2]
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
        AND (dc.id)::text = (storage.foldername(objects.name))[2]
    )
  )
);