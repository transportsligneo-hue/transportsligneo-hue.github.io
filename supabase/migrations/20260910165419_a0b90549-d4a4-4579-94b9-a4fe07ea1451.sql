DROP POLICY IF EXISTS "Convoyeurs read assigned cartes grises" ON storage.objects;

CREATE POLICY "Convoyeurs read assigned cartes grises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cartes-grises'
  AND EXISTS (
    SELECT 1
    FROM attributions a
    JOIN convoyeurs c ON c.id = a.convoyeur_id
    JOIN trajets t ON t.id = a.trajet_id
    WHERE c.user_id = auth.uid()
      AND (
        a.statut = ANY (ARRAY['accepte'::text, 'en_cours'::text])
        OR (a.statut = ANY (ARRAY['terminee'::text, 'termine'::text]) AND a.updated_at > now() - interval '24 hours')
      )
      AND (t.carte_grise_recto_url = objects.name OR t.carte_grise_verso_url = objects.name)
  )
);