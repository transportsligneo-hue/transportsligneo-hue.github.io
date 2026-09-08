GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_signatures TO authenticated;
GRANT ALL ON public.mission_signatures TO service_role;

DROP POLICY IF EXISTS "Convoyeurs update signatures of own missions" ON public.mission_signatures;
CREATE POLICY "Convoyeurs update signatures of own missions"
ON public.mission_signatures
FOR UPDATE
TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM attributions a JOIN convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()
))
WITH CHECK (attribution_id IN (
  SELECT a.id FROM attributions a JOIN convoyeurs c ON c.id = a.convoyeur_id WHERE c.user_id = auth.uid()
));