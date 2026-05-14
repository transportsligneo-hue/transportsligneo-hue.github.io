-- Drop existing update policies on attributions
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='attributions' AND cmd='UPDATE' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.attributions', pol.policyname);
  END LOOP;
END $$;

-- Driver can update their own attribution (status + etape_courante) using validation function
CREATE POLICY "Driver can update own attribution"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.convoyeurs c
    WHERE c.id = attributions.convoyeur_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  public.can_driver_update_attribution(
    id, trajet_id, convoyeur_id, numero_mission, statut
  )
);

-- Admin can update any attribution
CREATE POLICY "Admins can update attributions"
ON public.attributions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);