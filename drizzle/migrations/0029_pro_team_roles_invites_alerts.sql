ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_member_role_check;
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_member_role_check
  CHECK (member_role IN ('owner','admin','manager','member','viewer','logistique','comptabilite'));

CREATE TABLE public.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','logistique','comptabilite')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;
GRANT ALL ON public.org_invitations TO service_role;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins manage invitations" ON public.org_invitations FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE TABLE public.user_alert_preferences (
  user_id uuid PRIMARY KEY,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_alert_preferences TO authenticated;
GRANT ALL ON public.user_alert_preferences TO service_role;
ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own alert prefs" ON public.user_alert_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Org members read org activity" ON public.activity_logs FOR SELECT TO authenticated
  USING (actor_user_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.list_org_members(_org_id uuid)
RETURNS TABLE(id uuid, user_id uuid, member_role text, status text, email text, nom text, prenom text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.user_id, m.member_role, m.status, p.email, p.nom, p.prenom, m.joined_at
  FROM public.organization_members m LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = _org_id AND public.is_org_member(_org_id, auth.uid())
  ORDER BY m.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.list_org_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_org_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.org_invitations; uemail text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO inv FROM public.org_invitations WHERE token = _token;
  IF inv.id IS NULL OR inv.status <> 'pending' OR inv.expires_at < now() THEN RAISE EXCEPTION 'invalid_invitation'; END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  IF lower(uemail) <> lower(inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  INSERT INTO public.organization_members(organization_id, user_id, member_role, status, invited_by, invited_at, joined_at)
  VALUES (inv.organization_id, auth.uid(), inv.role, 'active', inv.invited_by, inv.created_at, now())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role, status = 'active', updated_at = now();
  UPDATE public.profiles SET organization_id = COALESCE(organization_id, inv.organization_id) WHERE id = auth.uid();
  UPDATE public.org_invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
  RETURN inv.organization_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_org_invitation(text) TO authenticated;