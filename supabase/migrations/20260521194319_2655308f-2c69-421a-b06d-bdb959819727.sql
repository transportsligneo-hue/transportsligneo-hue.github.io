ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS options_completion jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow drivers to update their own attribution's options_completion only
DROP POLICY IF EXISTS "Convoyeurs update own options_completion" ON public.attributions;
CREATE POLICY "Convoyeurs update own options_completion"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  convoyeur_id IN (
    SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  convoyeur_id IN (
    SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid()
  )
);
