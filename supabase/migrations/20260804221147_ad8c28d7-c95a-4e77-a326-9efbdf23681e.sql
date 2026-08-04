ALTER TABLE public.convoyeurs ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.accept_convoyeur_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.convoyeur_invitations%ROWTYPE;
  v_uid uuid := auth.uid();
  v_user_email text;
  v_conv_id uuid;
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

  v_conv_id := v_inv.convoyeur_id;

  IF v_conv_id IS NOT NULL THEN
    UPDATE public.convoyeurs
    SET user_id = v_uid,
        nom = COALESCE(nom, v_inv.nom),
        prenom = COALESCE(prenom, v_inv.prenom),
        telephone = COALESCE(telephone, v_inv.telephone),
        updated_at = now()
    WHERE id = v_conv_id AND (user_id IS NULL OR user_id = v_uid);
  END IF;

  IF v_conv_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.convoyeurs WHERE id = v_conv_id) THEN
    SELECT id INTO v_conv_id FROM public.convoyeurs WHERE user_id = v_uid LIMIT 1;
    IF v_conv_id IS NULL THEN
      INSERT INTO public.convoyeurs (user_id, email, nom, prenom, telephone, statut, account_status)
      VALUES (v_uid, lower(v_inv.email), v_inv.nom, v_inv.prenom, v_inv.telephone, 'en_attente', 'pending')
      RETURNING id INTO v_conv_id;
    END IF;
    UPDATE public.convoyeur_invitations SET convoyeur_id = v_conv_id WHERE id = v_inv.id;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'convoyeur')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.convoyeur_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'convoyeur_id', v_conv_id);
END;
$function$;