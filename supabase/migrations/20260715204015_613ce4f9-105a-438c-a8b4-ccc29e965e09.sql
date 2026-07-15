-- RLS policies for the private formation-images bucket
-- Admins can manage objects; authenticated users can read objects.

CREATE POLICY "Admins can manage formation images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'formation-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
WITH CHECK (bucket_id = 'formation-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Authenticated users can read formation images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'formation-images');