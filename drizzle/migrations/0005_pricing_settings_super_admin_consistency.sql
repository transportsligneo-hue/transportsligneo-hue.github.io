-- Aligner les policies pricing_settings : admin OU super_admin partout (cohérent avec SELECT)
DROP POLICY IF EXISTS "Admins can insert pricing settings" ON public.pricing_settings;
CREATE POLICY "Admins can insert pricing settings"
ON public.pricing_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update pricing settings" ON public.pricing_settings;
CREATE POLICY "Admins can update pricing settings"
ON public.pricing_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));