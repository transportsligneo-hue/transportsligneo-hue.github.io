-- 1) Formation images: restrict read to convoyeurs + admins
DROP POLICY IF EXISTS "Authenticated users can read formation images" ON storage.objects;
CREATE POLICY "Convoyeurs and admins can read formation images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'formation-images'
  AND (
    public.has_role(auth.uid(), 'convoyeur'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- 2) Loyalty settings: tighten read to explicit roles only
DROP POLICY IF EXISTS "loyalty_settings_read_auth" ON public.loyalty_settings;
CREATE POLICY "loyalty_settings_read_auth"
ON public.loyalty_settings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'client'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3) Trajets: keep fail-closed for anonymous visitors
REVOKE ALL ON public.trajets FROM anon;