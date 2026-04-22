-- 1. Drop the CHECK constraint that blocks all new vue_type values
ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_vue_type_check;

-- 2. Optional helper columns for the new visual workflow (non-breaking)
ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS zone_id text,
  ADD COLUMN IF NOT EXISTS file_size_bytes integer;

-- 3. Speed up admin lookups
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id
  ON public.inspection_photos(inspection_id);

-- 4. Drop the duplicate UNIQUE constraint (keep only one)
ALTER TABLE public.inspection_photos
  DROP CONSTRAINT IF EXISTS inspection_photos_inspection_vue_unique;