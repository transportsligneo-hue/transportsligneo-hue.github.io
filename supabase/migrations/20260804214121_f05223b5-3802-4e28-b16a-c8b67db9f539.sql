CREATE TABLE public.convoyeur_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nom text,
  prenom text,
  telephone text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','expired')),
  convoyeur_id uuid REFERENCES public.convoyeurs(id) ON DELETE SET NULL,
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE INDEX idx_convoyeur_invitations_email ON public.convoyeur_invitations (lower(email));
CREATE INDEX idx_convoyeur_invitations_status ON public.convoyeur_invitations (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convoyeur_invitations TO authenticated;
GRANT ALL ON public.convoyeur_invitations TO service_role;

ALTER TABLE public.convoyeur_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage convoyeur invitations"
ON public.convoyeur_invitations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_convoyeur_invitations_updated_at
BEFORE UPDATE ON public.convoyeur_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Création d'une invitation (admin uniquement) + fiche convoyeur associée
CREATE OR REPLACE FUNCTION public.admin_create_convoyeur_invitation(
  _email text,
  _nom text DEFAULT NULL,
  _prenom text DEFAULT NULL,
  _telephone text DEFAULT NULL
)
RETURNS TABLE (invitation_id uuid, token text, convoyeur_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_token text;
  v_inv_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _email IS NULL OR position('@' in _email) = 0 THEN
    RAISE EXCEPTION 'Email invalide';
  END IF;

  SELECT c.id INTO v_conv_id FROM public.convoyeurs c WHERE lower(c.email) = lower(_email) LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.convoyeurs (email, nom, prenom, telephone, statut, account_status)
    VALUES (lower(_email), _nom, _prenom, _telephone, 'en_attente', 'pending')
    RETURNING id INTO v_conv_id;
  END IF;

  UPDATE public.convoyeur_invitations
  SET status = 'cancelled'
  WHERE lower(email) = lower(_email) AND status = 'pending';

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.convoyeur_invitations (email, nom, prenom, telephone, token, convoyeur_id, invited_by)
  VALUES (lower(_email), _nom, _prenom, _telephone, v_token, v_conv_id, auth.uid())
  RETURNING id INTO v_inv_id;

  RETURN QUERY SELECT v_inv_id, v_token, v_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_convoyeur_invitation(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_convoyeur_invitation(text, text, text, text) TO authenticated;

-- Lecture publique restreinte d'une invitation via son jeton
CREATE OR REPLACE FUNCTION public.get_convoyeur_invitation(_token text)
RETURNS TABLE (email text, nom text, prenom text, telephone text, status text, expired boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.nom, i.prenom, i.telephone, i.status, (i.expires_at < now())
  FROM public.convoyeur_invitations i
  WHERE i.token = _token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_convoyeur_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_convoyeur_invitation(text) TO anon, authenticated;

-- Finalisation : rattache le compte créé à la fiche convoyeur
CREATE OR REPLACE FUNCTION public.accept_convoyeur_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.convoyeur_invitations%ROWTYPE;
  v_uid uuid := auth.uid();
  v_user_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_inv FROM public.convoyeur_invitations WHERE token = _token LIMIT 1;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_introuvable');
  END IF;
  IF v_inv.status <> 'pending' OR v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_invalide');
  END IF;

  SELECT lower(u.email) INTO v_user_email FROM auth.users u WHERE u.id = v_uid;
  IF v_user_email IS DISTINCT FROM lower(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_non_correspondant');
  END IF;

  UPDATE public.convoyeurs
  SET user_id = v_uid,
      nom = COALESCE(nom, v_inv.nom),
      prenom = COALESCE(prenom, v_inv.prenom),
      telephone = COALESCE(telephone, v_inv.telephone),
      updated_at = now()
  WHERE id = v_inv.convoyeur_id AND user_id IS NULL;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'convoyeur')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.convoyeur_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'convoyeur_id', v_inv.convoyeur_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_convoyeur_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_convoyeur_invitation(text) TO authenticated;