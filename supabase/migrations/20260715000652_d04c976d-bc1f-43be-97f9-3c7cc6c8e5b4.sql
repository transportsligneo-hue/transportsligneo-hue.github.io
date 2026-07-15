DROP POLICY "Client insert own acceptation" ON public.devis_acceptations;
CREATE POLICY "Client insert own acceptation" ON public.devis_acceptations
FOR INSERT TO authenticated
WITH CHECK (
  ((client_user_id = auth.uid())
    OR (lower(client_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))
  AND EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = devis_acceptations.devis_id
      AND (
        d.user_id = auth.uid()
        OR lower(COALESCE(d.email, '')) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      )
  )
);