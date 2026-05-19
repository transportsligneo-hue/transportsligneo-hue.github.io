-- Add company logo to client/partner profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Public storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
CREATE POLICY "Public read company logos" ON storage.objects
FOR SELECT USING (bucket_id = 'company-logos');

-- Authenticated users upload/manage their own folder (folder = user_id)
DROP POLICY IF EXISTS "Users upload own company logo" ON storage.objects;
CREATE POLICY "Users upload own company logo" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own company logo" ON storage.objects;
CREATE POLICY "Users update own company logo" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own company logo" ON storage.objects;
CREATE POLICY "Users delete own company logo" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins manage all logos
DROP POLICY IF EXISTS "Admins manage company logos" ON storage.objects;
CREATE POLICY "Admins manage company logos" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'company-logos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
WITH CHECK (bucket_id = 'company-logos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));