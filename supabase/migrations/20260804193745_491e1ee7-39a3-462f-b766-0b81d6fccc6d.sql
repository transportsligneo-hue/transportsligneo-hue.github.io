DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = 'transports.ligneo@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Compte CAT FRANCE introuvable';
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE lower(legal_name) = lower('CAT FRANCE (Tours, 37)')
     OR lower(coalesce(commercial_name, '')) = lower('CAT FRANCE')
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (
      legal_name,
      commercial_name,
      sector,
      status,
      account_type,
      primary_contact_email,
      created_by
    ) VALUES (
      'CAT FRANCE (Tours, 37)',
      'CAT FRANCE',
      'Transport automobile',
      'active',
      'flotte',
      'transports.ligneo@gmail.com',
      v_user_id
    ) RETURNING id INTO v_org_id;
  ELSE
    UPDATE public.organizations
    SET account_type = 'flotte',
        status = 'active',
        primary_contact_email = coalesce(primary_contact_email, 'transports.ligneo@gmail.com'),
        updated_at = now()
    WHERE id = v_org_id;
  END IF;

  UPDATE public.profiles
  SET organization_id = v_org_id,
      type_client = 'flotte',
      societe = 'CAT FRANCE (Tours, 37)'
  WHERE user_id = v_user_id;

  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    member_role,
    status
  ) VALUES (
    v_org_id,
    v_user_id,
    'admin',
    'active'
  )
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    member_role = 'admin',
    status = 'active',
    updated_at = now();
END $$;