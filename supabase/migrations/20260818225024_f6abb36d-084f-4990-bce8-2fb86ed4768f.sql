DROP POLICY IF EXISTS "Convoyeurs read assigned cartes grises" ON storage.objects;
CREATE POLICY "Convoyeurs read assigned cartes grises"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND EXISTS (
    SELECT 1
    FROM attributions a
    JOIN convoyeurs c ON c.id = a.convoyeur_id
    JOIN trajets t ON t.id = a.trajet_id
    WHERE c.user_id = auth.uid()
      AND (
        a.statut IN ('accepte', 'en_cours')
        OR (a.statut IN ('terminee', 'termine') AND a.updated_at > now() - interval '7 days')
      )
      AND (t.carte_grise_recto_url = objects.name OR t.carte_grise_verso_url = objects.name)
  )
);

DROP POLICY IF EXISTS "Authenticated read km tiers" ON public.km_tiers;
CREATE POLICY "Admins read km tiers"
ON public.km_tiers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));