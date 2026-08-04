-- 1) Merge duplicate CAT FRANCE: attach profile to its organization
UPDATE public.organizations o
SET siret = COALESCE(NULLIF(o.siret, ''), p.siret),
    logo_url = COALESCE(NULLIF(o.logo_url, ''), p.logo_url),
    primary_contact_email = COALESCE(o.primary_contact_email, p.email),
    primary_contact_phone = COALESCE(o.primary_contact_phone, p.telephone),
    account_type = CASE WHEN p.type_client = 'flotte' THEN 'flotte' ELSE o.account_type END,
    updated_at = now()
FROM public.organization_members m
JOIN public.profiles p ON p.user_id = m.user_id
WHERE m.organization_id = o.id
  AND m.status = 'active'
  AND m.member_role IN ('owner','admin')
  AND p.organization_id IS NULL;

-- 2) Link profiles that are already members of an organization
UPDATE public.profiles p
SET organization_id = m.organization_id, updated_at = now()
FROM public.organization_members m
WHERE m.user_id = p.user_id
  AND m.status = 'active'
  AND p.organization_id IS NULL;

-- 3) Ensure role badge exists for each organization
INSERT INTO public.organization_roles (organization_id, role, active)
SELECT o.id,
       CASE WHEN o.account_type = 'flotte' THEN 'flotte_partenaire' ELSE 'client_b2b' END,
       true
FROM public.organizations o
ON CONFLICT (organization_id, role) DO NOTHING;