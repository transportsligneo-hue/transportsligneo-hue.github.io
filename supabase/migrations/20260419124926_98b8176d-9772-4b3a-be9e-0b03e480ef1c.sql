-- 1. Add 'client' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Add new columns to convoyeurs
ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS permis_numero TEXT,
  ADD COLUMN IF NOT EXISTS annees_experience INTEGER,
  ADD COLUMN IF NOT EXISTS permis_photo_url TEXT;

-- 3. Create storage bucket for driving licenses (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('convoyeur-permis', 'convoyeur-permis', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies: convoyeur uploads + reads own, admin reads all
CREATE POLICY "Convoyeurs upload own permis"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'convoyeur-permis'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Convoyeurs read own permis"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'convoyeur-permis'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins manage all permis"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'convoyeur-permis'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);