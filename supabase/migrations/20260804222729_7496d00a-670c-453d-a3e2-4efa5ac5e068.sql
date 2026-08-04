CREATE OR REPLACE FUNCTION public.admin_create_convoyeur_invitation(
  _email text,
  _nom text DEFAULT NULL,
  _prenom text DEFAULT NULL,
  _telephone text DEFAULT NULL
)
RETURNS TABLE(invitation_id uuid, token text, convoyeur_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_conv_id uuid;
  v_token text;
  v_inv_id uuid;
  v_email text := lower(trim(_email));
  v_nom text := nullif(trim(_nom), '');
  v_prenom text := nullif(trim(_prenom), '');
  v_telephone text := nullif(trim(_telephone), '');
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL
     OR length(v_email) > 320
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Email invalide' USING ERRCODE = '22023';
  END IF;

  SELECT c.id
    INTO v_conv_id
    FROM public.convoyeurs c
   WHERE lower(c.email) = v_email
   ORDER BY c.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.convoyeurs (email, nom, prenom, telephone, statut, account_status)
    VALUES (v_email, v_nom, v_prenom, v_telephone, 'en_attente', 'pending')
    RETURNING id INTO v_conv_id;
  ELSE
    UPDATE public.convoyeurs
       SET nom = COALESCE(v_nom, nom),
           prenom = COALESCE(v_prenom, prenom),
           telephone = COALESCE(v_telephone, telephone),
           updated_at = now()
     WHERE id = v_conv_id;
  END IF;

  UPDATE public.convoyeur_invitations
     SET status = 'cancelled'
   WHERE lower(email) = v_email
     AND status = 'pending';

  LOOP
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.convoyeur_invitations i WHERE i.token = v_token
    );
  END LOOP;

  INSERT INTO public.convoyeur_invitations (
    email, nom, prenom, telephone, token, convoyeur_id, invited_by,
    status, expires_at
  )
  VALUES (
    v_email, v_nom, v_prenom, v_telephone, v_token, v_conv_id, auth.uid(),
    'pending', now() + interval '7 days'
  )
  RETURNING id INTO v_inv_id;

  RETURN QUERY SELECT v_inv_id, v_token, v_conv_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_convoyeur_invitation(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_convoyeur_invitation(text, text, text, text) TO authenticated, service_role;