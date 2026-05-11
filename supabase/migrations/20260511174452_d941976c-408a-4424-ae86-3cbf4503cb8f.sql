
-- Allow clients to read their own devis (matched by profile email)
CREATE POLICY "Clients can read own devis"
ON public.devis
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
  OR email IN (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Allow clients to read their own demandes (matched by profile email)
CREATE POLICY "Clients can read own demandes"
ON public.demandes_convoyage
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
  OR email IN (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid())
);
