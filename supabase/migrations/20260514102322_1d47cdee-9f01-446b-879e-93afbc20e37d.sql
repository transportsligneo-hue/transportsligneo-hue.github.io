-- 1) Remove broad PII exposure on trajets for validated convoyeurs.
-- Discovery of available missions must go through the public.trajets_publies_safe view.
-- Assigned-trajet access is preserved by the existing "Convoyeurs can see assigned trajets" policy.
DROP POLICY IF EXISTS "Convoyeurs valides voient trajets publies" ON public.trajets;

-- 2) Tighten convoyeur-documents SELECT policy: require an ownership join,
-- matching the existing UPDATE policy pattern.
DROP POLICY IF EXISTS "Convoyeurs can view own documents" ON storage.objects;

CREATE POLICY "Convoyeurs can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'convoyeur-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1
    FROM public.documents_convoyeurs d
    JOIN public.convoyeurs c ON c.id = d.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND d.url_fichier LIKE ('%' || objects.name)
  )
);