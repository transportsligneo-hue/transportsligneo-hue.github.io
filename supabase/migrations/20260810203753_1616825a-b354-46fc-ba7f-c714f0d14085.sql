GRANT SELECT ON public.pricing_settings TO anon, authenticated;

CREATE POLICY "Public can read billing regime"
ON public.pricing_settings
FOR SELECT
TO anon, authenticated
USING (true);