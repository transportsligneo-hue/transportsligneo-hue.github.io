DROP POLICY IF EXISTS "Convoyeurs read assigned trajets" ON public.trajets;

DROP POLICY IF EXISTS "Only admins can write roles" ON public.user_roles;
CREATE POLICY "Only admins can write roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Clients read own mission inspection photos" ON public.inspection_photos;
CREATE POLICY "Clients read own mission inspection photos"
ON public.inspection_photos
FOR SELECT
TO authenticated
USING (
  inspection_id IN (
    SELECT i.id
    FROM public.inspections i
    JOIN public.attributions a ON a.id = i.attribution_id
    JOIN public.trajets t ON t.id = a.trajet_id
    LEFT JOIN public.devis d ON d.id = t.devis_id
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    WHERE d.user_id = auth.uid()
       OR dc.user_id = auth.uid()
       OR lower(coalesce(d.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
       OR lower(coalesce(dc.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);