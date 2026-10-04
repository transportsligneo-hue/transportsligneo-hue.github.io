CREATE OR REPLACE FUNCTION public.ensure_my_organization()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid; _p record;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT organization_id, type_client, societe, nom, prenom, email INTO _p FROM profiles WHERE user_id = _uid;
  IF _p IS NULL OR coalesce(_p.type_client,'') = 'particulier' THEN RETURN NULL; END IF;
  _org := _p.organization_id;
  IF _org IS NULL THEN
    SELECT organization_id INTO _org FROM organization_members WHERE user_id=_uid AND status='active' LIMIT 1;
  END IF;
  IF _org IS NULL THEN
    INSERT INTO organizations(legal_name, account_type, created_by, primary_contact_email)
    VALUES (coalesce(nullif(_p.societe,''), nullif(trim(coalesce(_p.prenom,'')||' '||coalesce(_p.nom,'')),''), 'Ma société'),
            CASE WHEN _p.type_client='flotte' THEN 'flotte' ELSE 'b2b_standard' END, _uid, _p.email)
    RETURNING id INTO _org;
  END IF;
  INSERT INTO organization_members(organization_id,user_id,member_role,status)
  VALUES (_org,_uid,'owner','active') ON CONFLICT (organization_id,user_id) DO NOTHING;
  UPDATE profiles SET organization_id=_org WHERE user_id=_uid AND organization_id IS NULL;
  RETURN _org;
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_organization() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_organization() TO authenticated;