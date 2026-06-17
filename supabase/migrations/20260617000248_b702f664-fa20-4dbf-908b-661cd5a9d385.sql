
-- 1. Storage inspection-photos: add admin ALL management policy
CREATE POLICY "Admins manage inspection photos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- 2. mission_signatures: replace overbroad convoyeur ALL policy with INSERT + SELECT only.
DROP POLICY IF EXISTS "Convoyeurs manage signatures of own missions" ON public.mission_signatures;

CREATE POLICY "Convoyeurs insert signatures of own missions"
ON public.mission_signatures
FOR INSERT
TO authenticated
WITH CHECK (
  attribution_id IN (
    SELECT a.id
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Convoyeurs read signatures of own missions"
ON public.mission_signatures
FOR SELECT
TO authenticated
USING (
  attribution_id IN (
    SELECT a.id
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
  )
);
