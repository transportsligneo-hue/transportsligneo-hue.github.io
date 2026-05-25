
-- Remove overly-permissive storage policies on mission-documents bucket.
-- Scoped policies (admin, convoyeur per-attribution, client per-attribution) remain.
DROP POLICY IF EXISTS "Authenticated read mission-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to mission-documents" ON storage.objects;

-- Remove broad SELECT policy on public company-logos bucket to prevent listing.
-- Files remain reachable via their public URLs because the bucket is marked public.
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
