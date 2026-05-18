
-- mission_selfies: require assigned convoyeur
DROP POLICY IF EXISTS "Convoyeurs insert own selfies" ON public.mission_selfies;
DROP POLICY IF EXISTS "Convoyeurs can insert own selfies" ON public.mission_selfies;
DROP POLICY IF EXISTS "Convoyeurs create own selfies" ON public.mission_selfies;

CREATE POLICY "Convoyeurs insert own assigned selfies"
ON public.mission_selfies
FOR INSERT
TO authenticated
WITH CHECK (
  convoyeur_user_id = auth.uid()
  AND attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  )
);

-- mission_incidents: require assigned convoyeur
DROP POLICY IF EXISTS "Convoyeurs create own incidents" ON public.mission_incidents;

CREATE POLICY "Convoyeurs create own assigned incidents"
ON public.mission_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  convoyeur_user_id = auth.uid()
  AND attribution_id IN (
    SELECT a.id FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  )
);

-- storage mission-selfies: tighten INSERT to require assigned attribution
-- Path format used in code: {userId}/{attributionId}/selfie_*.{ext}
DROP POLICY IF EXISTS "Convoyeurs upload own selfies" ON storage.objects;
DROP POLICY IF EXISTS "Convoyeurs can upload selfies" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own mission selfies" ON storage.objects;
DROP POLICY IF EXISTS "Mission selfies upload" ON storage.objects;

CREATE POLICY "Convoyeurs upload selfies for own attribution"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mission-selfies'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[2]
  )
);
