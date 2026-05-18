
-- Fix 1: Remove direct SELECT on trajets for validated convoyeurs (PII exposure).
-- Discovery flows go through the trajets_publies_safe view, which strips PII.
-- Assigned trajets remain readable via the existing "Convoyeurs can see assigned trajets" policy.
DROP POLICY IF EXISTS "Convoyeurs valides voient trajets publies" ON public.trajets;

-- Fix 2: Avatars bucket — remove broad listing policy on storage.objects.
-- Public URL fetches (/storage/v1/object/public/avatars/...) bypass RLS and keep working.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
