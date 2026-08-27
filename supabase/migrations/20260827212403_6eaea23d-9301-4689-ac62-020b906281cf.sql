DROP POLICY IF EXISTS "Users can create own missions" ON public.missions;
CREATE POLICY "Users can create own missions"
ON public.missions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()))
  AND (fleet_organization_id IS NULL OR public.is_org_member(fleet_organization_id, auth.uid()))
);

REVOKE ALL ON public.trajets FROM anon;
REVOKE SELECT (prix_convoyeur, prix_societe, commission_convoyeur_pct) ON public.trajets FROM anon;
COMMENT ON COLUMN public.trajets.prix_societe IS 'Donnée interne (marge). Ne jamais exposer via une policy SELECT client/anon.';
COMMENT ON COLUMN public.trajets.commission_convoyeur_pct IS 'Donnée interne (marge). Ne jamais exposer via une policy SELECT client/anon.';
COMMENT ON COLUMN public.trajets.prix_convoyeur IS 'Rémunération convoyeur : réservé admin + convoyeur assigné, jamais au client.';