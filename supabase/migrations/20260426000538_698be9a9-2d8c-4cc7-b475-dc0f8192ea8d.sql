
-- 1) Restrict companies table reads to admins only
DROP POLICY IF EXISTS "Anyone can read company by email" ON public.companies;

-- Anonymous/authenticated users can no longer SELECT companies directly.
-- Admin SELECT continues to work via the existing "Admins manage companies" ALL policy.

-- 2) Secure RPC for public B2B forms to find-or-create their own company by email
CREATE OR REPLACE FUNCTION public.find_or_create_company(
  _name text,
  _type text,
  _contact_name text,
  _contact_email text,
  _contact_phone text,
  _siret text DEFAULT NULL,
  _sector text DEFAULT NULL,
  _size text DEFAULT NULL,
  _contact_function text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_company_id uuid;
BEGIN
  -- Basic validation
  IF _contact_email IS NULL OR length(trim(_contact_email)) < 3 THEN
    RAISE EXCEPTION 'Invalid contact email';
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 1 OR length(trim(_name)) > 200 THEN
    RAISE EXCEPTION 'Invalid company name';
  END IF;
  IF _contact_name IS NULL OR length(trim(_contact_name)) < 1 OR length(trim(_contact_name)) > 200 THEN
    RAISE EXCEPTION 'Invalid contact name';
  END IF;
  IF _contact_phone IS NULL OR length(trim(_contact_phone)) < 1 OR length(trim(_contact_phone)) > 50 THEN
    RAISE EXCEPTION 'Invalid contact phone';
  END IF;

  v_email := lower(trim(_contact_email));

  -- Lookup by email (this runs with definer rights, but only returns the id)
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE lower(contact_email) = v_email
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  INSERT INTO public.companies (
    name, type, contact_name, contact_email, contact_phone,
    siret, sector, size, contact_function
  )
  VALUES (
    trim(_name),
    COALESCE(_type, 'autre'),
    trim(_contact_name),
    v_email,
    trim(_contact_phone),
    NULLIF(trim(COALESCE(_siret, '')), ''),
    NULLIF(trim(COALESCE(_sector, '')), ''),
    NULLIF(trim(COALESCE(_size, '')), ''),
    NULLIF(trim(COALESCE(_contact_function, '')), '')
  )
  RETURNING id INTO v_company_id;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_company(
  text, text, text, text, text, text, text, text, text
) TO anon, authenticated;

-- 3) Remove privilege escalation: drop self-insert role policy.
-- Roles are assigned by the SECURITY DEFINER handle_new_user() trigger at signup,
-- or by admins via the existing "Admins can manage roles" policy.
DROP POLICY IF EXISTS "Users can insert own non-admin role" ON public.user_roles;

-- 4) Tighten inspection-photos storage upload policy:
-- require that the folder path matches an inspection actually owned by the convoyeur.
-- Path layout: {user_id}/{inspection_id}/zone_xxx_TIMESTAMP.jpg
DROP POLICY IF EXISTS "Convoyeurs can upload inspection photos" ON storage.objects;
DROP POLICY IF EXISTS "Convoyeurs upload own inspection photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload inspection photos" ON storage.objects;

CREATE POLICY "Convoyeurs upload own inspection photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.inspections i
    JOIN public.attributions a ON a.id = i.attribution_id
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND i.id::text = (storage.foldername(name))[2]
  )
);

-- Also tighten read/update/delete on inspection-photos to the owning convoyeur or an admin
DROP POLICY IF EXISTS "Convoyeurs read own inspection photos" ON storage.objects;
CREATE POLICY "Convoyeurs read own inspection photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.inspections i
        JOIN public.attributions a ON a.id = i.attribution_id
        JOIN public.convoyeurs c ON c.id = a.convoyeur_id
        WHERE c.user_id = auth.uid()
          AND i.id::text = (storage.foldername(name))[2]
      )
    )
  )
);

DROP POLICY IF EXISTS "Convoyeurs update own inspection photos" ON storage.objects;
CREATE POLICY "Convoyeurs update own inspection photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.inspections i
    JOIN public.attributions a ON a.id = i.attribution_id
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND i.id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "Convoyeurs delete own inspection photos" ON storage.objects;
CREATE POLICY "Convoyeurs delete own inspection photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.inspections i
    JOIN public.attributions a ON a.id = i.attribution_id
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE c.user_id = auth.uid()
      AND i.id::text = (storage.foldername(name))[2]
  )
);
