
-- Helper: verifie que les champs privilegies d'un profil restent inchanges
CREATE OR REPLACE FUNCTION public.profiles_self_update_allowed(
  _user_id uuid,
  _organization_id uuid,
  _type_client text,
  _account_status text,
  _statut text,
  _exempte_acceptation_devis boolean,
  _relances_disabled boolean,
  _pricing_display_mode text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = _user_id
          AND p.organization_id IS NOT DISTINCT FROM _organization_id
          AND p.type_client IS NOT DISTINCT FROM _type_client
          AND p.account_status IS NOT DISTINCT FROM _account_status
          AND p.statut IS NOT DISTINCT FROM _statut
          AND p.exempte_acceptation_devis IS NOT DISTINCT FROM _exempte_acceptation_devis
          AND p.relances_disabled IS NOT DISTINCT FROM _relances_disabled
          AND p.pricing_display_mode IS NOT DISTINCT FROM _pricing_display_mode
      );
$$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.profiles_self_update_allowed(
    user_id, organization_id, type_client, account_status, statut,
    exempte_acceptation_devis, relances_disabled, pricing_display_mode
  )
);

-- Helper: verifie que les champs privilegies d'une fiche convoyeur restent inchanges
CREATE OR REPLACE FUNCTION public.convoyeurs_self_update_allowed(
  _id uuid,
  _statut text,
  _account_status text,
  _niveau text,
  _missions_terminees integer,
  _note_moyenne numeric,
  _organization_id uuid,
  _type_convoyeur text,
  _training_status text,
  _has_completed_training boolean,
  _email text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.convoyeurs c
        WHERE c.id = _id
          AND c.statut IS NOT DISTINCT FROM _statut
          AND c.account_status IS NOT DISTINCT FROM _account_status
          AND c.niveau IS NOT DISTINCT FROM _niveau
          AND c.missions_terminees IS NOT DISTINCT FROM _missions_terminees
          AND c.note_moyenne IS NOT DISTINCT FROM _note_moyenne
          AND c.organization_id IS NOT DISTINCT FROM _organization_id
          AND c.type_convoyeur IS NOT DISTINCT FROM _type_convoyeur
          AND c.training_status IS NOT DISTINCT FROM _training_status
          AND c.has_completed_training IS NOT DISTINCT FROM _has_completed_training
          AND c.email IS NOT DISTINCT FROM _email
      );
$$;

DROP POLICY IF EXISTS "Convoyeurs can update own record" ON public.convoyeurs;
CREATE POLICY "Convoyeurs can update own record"
ON public.convoyeurs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.convoyeurs_self_update_allowed(
    id, statut, account_status, niveau, missions_terminees, note_moyenne,
    organization_id, type_convoyeur, training_status, has_completed_training, email
  )
);
